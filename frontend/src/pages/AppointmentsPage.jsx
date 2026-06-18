import { useState, useEffect, useMemo } from 'react';
import { appointmentAPI, doctorAPI, patientAPI, reminderAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  Calendar,
  Plus,
  Loader2,
  X,
  Filter,
  ChevronLeft,
  ChevronRight,
  Clock,
  List,
  Grid3X3,
  ChevronDown,
  Send,
} from 'lucide-react';
import toast from 'react-hot-toast';

const statuses = ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

const STATUS_COLORS = {
  SCHEDULED: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500', border: 'border-l-blue-500' },
  CONFIRMED: { bg: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-500', border: 'border-l-indigo-500' },
  IN_PROGRESS: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500', border: 'border-l-amber-500' },
  COMPLETED: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', border: 'border-l-emerald-500' },
  CANCELLED: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500', border: 'border-l-red-500' },
  NO_SHOW: { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-500', border: 'border-l-gray-500' },
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

function formatDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDayPanel, setShowDayPanel] = useState(false);
  const [form, setForm] = useState({ doctorId: '', patientId: '', dateTime: '', duration: 30, reason: '' });
  const [sendingReminder, setSendingReminder] = useState(null);
  const { isAdmin, isDoctor, isReceptionist } = useAuth();
  const canEdit = isAdmin || isDoctor || isReceptionist;

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const daysInPrevMonth = getDaysInMonth(year, month - 1);

  // Group appointments by date key
  const appointmentsByDate = useMemo(() => {
    const map = {};
    appointments.forEach((appt) => {
      const key = formatDateKey(new Date(appt.dateTime));
      if (!map[key]) map[key] = [];
      map[key].push(appt);
    });
    return map;
  }, [appointments]);

  // Filter appointments for selected day
  const dayAppointments = useMemo(() => {
    const key = formatDateKey(selectedDate);
    return appointmentsByDate[key] || [];
  }, [appointmentsByDate, selectedDate]);

  const fetchAppointments = (monthStart, monthEnd) => {
    setLoading(true);
    const params = {};
    if (filterStatus) params.status = filterStatus;
    params.start = monthStart.toISOString();
    params.end = monthEnd.toISOString();

    appointmentAPI
      .getAll(params)
      .then((res) => setAppointments(res.data))
      .catch(() => toast.error('Failed to load appointments'))
      .finally(() => setLoading(false));
  };

  // Load initial data (doctors, patients)
  useEffect(() => {
    doctorAPI.getAll()
      .then((res) => setDoctors(res.data))
      .catch(() => {});
    patientAPI.getAll({})
      .then((res) => setPatients(res.data))
      .catch(() => {});
  }, []);  // Fetch appointments when view mode, filter, or month changes
  useEffect(() => {
    if (viewMode === 'list') {
      setLoading(true);
      const params = {};
      if (filterStatus) params.status = filterStatus;
      appointmentAPI
        .getAll(params)
        .then((res) => setAppointments(res.data))
        .catch(() => toast.error('Failed to load appointments'))
        .finally(() => setLoading(false));
    } else if (viewMode === 'calendar') {
      const start = new Date(year, month, 1);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(year, month + 1, 0);
      end.setDate(end.getDate() + (6 - end.getDay()));
      end.setHours(23, 59, 59, 999);
      fetchAppointments(start, end);
    }
  }, [currentMonth, filterStatus, viewMode]);

  const navigateMonth = (delta) => {
    const newMonth = new Date(year, month + delta, 1);
    setCurrentMonth(newMonth);
    setShowDayPanel(false);
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
    setShowDayPanel(true);
  };

  const handleDayClick = (date) => {
    setSelectedDate(date);
    setShowDayPanel(true);
  };

  const handleCreateFromDay = () => {
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    setForm({
      ...form,
      dateTime: `${year}-${month}-${day}T09:00`,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await appointmentAPI.create(form);
      toast.success('Appointment created');
      setShowModal(false);
      setForm({ doctorId: '', patientId: '', dateTime: '', duration: 30, reason: '' });
      // Refresh
      const start = new Date(year, month, 1);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(year, month + 1, 0);
      end.setDate(end.getDate() + (6 - end.getDay()));
      end.setHours(23, 59, 59, 999);
      fetchAppointments(start, end);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create appointment');
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await appointmentAPI.update(id, { status });
      toast.success(`Appointment ${status.toLowerCase().replace('_', ' ')}`);
      // Refresh
      const start = new Date(year, month, 1);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(year, month + 1, 0);
      end.setDate(end.getDate() + (6 - end.getDay()));
      end.setHours(23, 59, 59, 999);
      fetchAppointments(start, end);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const getStatusBadge = (status) => {
    const c = STATUS_COLORS[status] || STATUS_COLORS.SCHEDULED;
    return `${c.bg} ${c.text}`;
  };

  // Build calendar grid
  const calendarDays = [];
  // Previous month's trailing days
  for (let i = firstDay - 1; i >= 0; i--) {
    calendarDays.push({
      day: daysInPrevMonth - i,
      date: new Date(year, month - 1, daysInPrevMonth - i),
      isCurrentMonth: false,
    });
  }
  // Current month's days
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push({
      day: i,
      date: new Date(year, month, i),
      isCurrentMonth: true,
    });
  }
  // Next month's leading days
  const remaining = 7 - (calendarDays.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      calendarDays.push({
        day: i,
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }
  }

  const today = new Date();
  const isToday = (date) => isSameDay(date, today);
  const isSelected = (date) => isSameDay(date, selectedDate);

  // Get appointments for a specific date
  const getApptsForDate = (date) => {
    const key = formatDateKey(date);
    return appointmentsByDate[key] || [];
  };

  // Count by status
  const countByStatus = (appts) => {
    const counts = {};
    appts.forEach((a) => {
      counts[a.status] = (counts[a.status] || 0) + 1;
    });
    return counts;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
          <p className="text-gray-500 mt-1">Schedule and manage patient appointments</p>
        </div>
        <div className="flex items-center gap-3">
          {canEdit && (
            <button onClick={() => setShowModal(true)} className="btn-primary">
              <Plus className="w-4 h-4" />
              New Appointment
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'calendar' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Grid3X3 className="w-3.5 h-3.5 inline mr-1" />
              Calendar
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'list' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <List className="w-3.5 h-3.5 inline mr-1" />
              List
            </button>
          </div>

          {/* Status filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              className="input pl-10 pr-8 text-sm"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              {statuses.map((s) => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
        </div>

        {viewMode === 'calendar' && (
          <div className="flex items-center gap-2">
            <button onClick={goToToday} className="btn-sm btn-secondary">
              Today
            </button>
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigateMonth(-1)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm font-semibold text-gray-900 min-w-[160px] text-center">
                {MONTH_NAMES[month]} {year}
              </span>
              <button
                onClick={() => navigateMonth(1)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div className="flex gap-6">
          {/* Calendar Grid */}
          <div className="flex-1 min-w-0">
            <div className="card overflow-hidden">
              {/* Day headers */}
              <div className="grid grid-cols-7 border-b border-gray-100">
                {DAY_NAMES.map((name) => (
                  <div key={name} className="px-2 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {name}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7">
                {calendarDays.map((dayData, idx) => {
                  const appts = getApptsForDate(dayData.date);
                  const statusCounts = countByStatus(appts);
                  const hasAppts = appts.length > 0;

                  return (
                    <button
                      key={idx}
                      onClick={() => handleDayClick(dayData.date)}
                      className={`relative min-h-[90px] p-1.5 border-b border-r border-gray-100 text-left transition-colors hover:bg-gray-50/80 ${
                        !dayData.isCurrentMonth ? 'bg-gray-50/50' : ''
                      } ${isSelected(dayData.date) ? 'ring-2 ring-primary-500 ring-inset z-10 bg-primary-50/50' : ''} ${
                        isToday(dayData.date) ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      {/* Day number */}
                      <span
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium ${
                          isToday(dayData.date)
                            ? 'bg-primary-600 text-white'
                            : isSelected(dayData.date)
                            ? 'bg-primary-600 text-white'
                            : dayData.isCurrentMonth
                            ? 'text-gray-900'
                            : 'text-gray-400'
                        }`}
                      >
                        {dayData.day}
                      </span>

                      {/* Appointment indicators */}
                      {hasAppts && (
                        <div className="mt-1 space-y-0.5">
                          {Object.entries(statusCounts).slice(0, 3).map(([status, count]) => (
                            <div
                              key={status}
                              className={`flex items-center gap-1 px-1 py-0.5 rounded ${
                                STATUS_COLORS[status]?.bg || 'bg-gray-100'
                              }`}
                            >
                              <div className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[status]?.dot || 'bg-gray-500'}`} />
                              <span className="text-[10px] font-medium text-gray-600 truncate">
                                {count} {status.replace('_', ' ')}
                              </span>
                            </div>
                          ))}
                          {appts.length > 3 && (
                            <span className="text-[10px] text-gray-400 pl-1">
                              +{appts.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Day Detail Panel */}
          {showDayPanel && (
            <div className="w-80 shrink-0">
              <div className="card overflow-hidden sticky top-6">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">
                      {selectedDate.toLocaleDateString('en-US', { weekday: 'long' })}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowDayPanel(false)}
                    className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-4">
                  {loading ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
                    </div>
                  ) : dayAppointments.length === 0 ? (
                    <div className="text-center py-6">
                      <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm text-gray-400 mb-3">No appointments on this day</p>
                      {canEdit && (
                        <button onClick={handleCreateFromDay} className="btn-sm btn-primary">
                          <Plus className="w-3 h-3" />
                          Book Appointment
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {dayAppointments.map((appt) => (
                        <div
                          key={appt.id}
                          className={`rounded-lg border-l-4 ${STATUS_COLORS[appt.status]?.border || 'border-l-gray-500'} bg-white border border-gray-200 border-l-4 p-3 hover:shadow-sm transition-shadow`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-medium text-gray-900">
                              {appt.patient?.firstName} {appt.patient?.lastName}
                            </span>
                            <span className={`badge text-[10px] ${getStatusBadge(appt.status)}`}>
                              {appt.status.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(appt.dateTime)} ({appt.duration} min)
                          </div>
                          <p className="text-xs text-gray-500">
                            Dr. {appt.doctor?.user?.name}
                          </p>
                          {appt.reason && (
                            <p className="text-xs text-gray-400 mt-1 truncate">{appt.reason}</p>
                          )}

                          {/* Quick actions */}
                          <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-gray-100">
                            {(appt.status === 'SCHEDULED' || appt.status === 'CONFIRMED') && (
                              <button
                                disabled={sendingReminder === appt.id}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  setSendingReminder(appt.id);
                                  try {
                                    const res = await reminderAPI.sendForAppointment(appt.id);
                                    toast.success(res.data.message || 'Reminder sent!');
                                  } catch (err) {
                                    toast.error(err.response?.data?.error || 'Failed to send reminder');
                                  } finally {
                                    setSendingReminder(null);
                                  }
                                }}
                                className="btn-sm text-[10px] px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded"
                              >
                                <Send className="w-3 h-3" />
                                {sendingReminder === appt.id ? '...' : 'Remind'}
                              </button>
                            )}
                            {appt.status === 'SCHEDULED' && (
                              <>
                                <button onClick={() => handleStatusChange(appt.id, 'CONFIRMED')} className="btn-sm text-[10px] px-2 py-1 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 rounded">Confirm</button>
                                <button onClick={() => handleStatusChange(appt.id, 'CANCELLED')} className="btn-sm text-[10px] px-2 py-1 bg-white text-red-600 border border-red-200 hover:bg-red-50 rounded">Cancel</button>
                              </>
                            )}
                            {appt.status === 'CONFIRMED' && (
                              <button onClick={() => handleStatusChange(appt.id, 'IN_PROGRESS')} className="btn-sm text-[10px] px-2 py-1 bg-primary-50 text-primary-700 hover:bg-primary-100 rounded">Start</button>
                            )}
                            {appt.status === 'IN_PROGRESS' && (
                              <button onClick={() => handleStatusChange(appt.id, 'COMPLETED')} className="btn-sm text-[10px] px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded">Complete</button>
                            )}
                          </div>
                        </div>
                      ))}

                      {canEdit && (
                        <button onClick={handleCreateFromDay} className="btn-sm btn-secondary w-full mt-2">
                          <Plus className="w-3 h-3" />
                          Add Appointment
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="card overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
          ) : appointments.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No appointments found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-500">
                    <th className="px-5 py-3 font-medium">Patient</th>
                    <th className="px-5 py-3 font-medium">Doctor</th>
                    <th className="px-5 py-3 font-medium">Date & Time</th>
                    <th className="px-5 py-3 font-medium">Duration</th>
                    <th className="px-5 py-3 font-medium">Reason</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((appt) => (
                    <tr key={appt.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <span className="font-medium text-gray-900">
                          {appt.patient?.firstName} {appt.patient?.lastName}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-600">{appt.doctor?.user?.name}</td>
                      <td className="px-5 py-3 text-gray-600 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          {formatDate(appt.dateTime)} {formatTime(appt.dateTime)}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-600">{appt.duration} min</td>
                      <td className="px-5 py-3 text-gray-500 max-w-[200px] truncate">{appt.reason || '-'}</td>
                      <td className="px-5 py-3">
                        <span className={`badge ${getStatusBadge(appt.status)}`}>
                          {appt.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {canEdit && (
                          <div className="flex flex-wrap gap-1">
                            {(appt.status === 'SCHEDULED' || appt.status === 'CONFIRMED') && (
                              <button
                                disabled={sendingReminder === appt.id}
                                onClick={async () => {
                                  setSendingReminder(appt.id);
                                  try {
                                    const res = await reminderAPI.sendForAppointment(appt.id);
                                    toast.success(res.data.message || 'Reminder sent!');
                                  } catch (err) {
                                    toast.error(err.response?.data?.error || 'Failed to send reminder');
                                  } finally {
                                    setSendingReminder(null);
                                  }
                                }}
                                className="btn-sm btn-remind"
                                title="Send WhatsApp reminder"
                              >
                                {sendingReminder === appt.id ? 'Sending...' : 'Remind'}
                              </button>
                            )}
                            {appt.status === 'SCHEDULED' && (
                              <>
                                <button onClick={() => handleStatusChange(appt.id, 'CONFIRMED')} className="btn-sm btn-secondary">Confirm</button>
                                <button onClick={() => handleStatusChange(appt.id, 'CANCELLED')} className="btn-sm btn-danger">Cancel</button>
                              </>
                            )}
                            {appt.status === 'CONFIRMED' && (
                              <button onClick={() => handleStatusChange(appt.id, 'IN_PROGRESS')} className="btn-sm btn-primary">Start</button>
                            )}
                            {appt.status === 'IN_PROGRESS' && (
                              <button onClick={() => handleStatusChange(appt.id, 'COMPLETED')} className="btn-sm btn-primary">Complete</button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">New Appointment</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Doctor *</label>
                <select className="input" value={form.doctorId} onChange={(e) => setForm({...form, doctorId: e.target.value})} required>
                  <option value="">Select doctor...</option>
                  {doctors.map((d) => <option key={d.id} value={d.id}>{d.user?.name} - {d.specialization}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Patient *</label>
                <select className="input" value={form.patientId} onChange={(e) => setForm({...form, patientId: e.target.value})} required>
                  <option value="">Select patient...</option>
                  {patients.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} - {p.phone}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Date & Time *</label>
                <input type="datetime-local" className="input" value={form.dateTime} onChange={(e) => setForm({...form, dateTime: e.target.value})} required />
              </div>
              <div>
                <label className="label">Duration (minutes)</label>
                <input type="number" className="input" value={form.duration} onChange={(e) => setForm({...form, duration: parseInt(e.target.value)})} min={15} step={15} />
              </div>
              <div>
                <label className="label">Reason</label>
                <textarea className="input" rows={2} value={form.reason} onChange={(e) => setForm({...form, reason: e.target.value})} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">Create</button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
