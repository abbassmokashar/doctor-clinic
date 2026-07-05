import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { appointmentAPI, doctorAPI, patientAPI, reminderAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import MultiTabForm from '../components/MultiTabForm';
import ConfirmModal from '../components/ConfirmModal';
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
  Send,
  AlertTriangle,
  Pencil,
  ArrowUp,
  ArrowDown,
  CalendarRange,
  SlidersHorizontal,
  RotateCcw,
  Zap,
  Activity,
} from 'lucide-react';
import toast from 'react-hot-toast';

const statuses = ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

const STATUS_COLORS = {
  SCHEDULED: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500', border: 'border-l-blue-500' },
  CONFIRMED: { bg: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-500', border: 'border-l-indigo-500' },
  IN_PROGRESS: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500', border: 'border-l-amber-500' },
  COMPLETED: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', border: 'border-l-emerald-500' },
  CANCELLED: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500', border: 'border-l-red-500' },
  NO_SHOW: { bg: 'bg-gray-200', text: 'text-gray-700', dot: 'bg-gray-500', border: 'border-l-gray-500' },
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
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [sortBy, setSortBy] = useState('dateTime');
  const [sortOrder, setSortOrder] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [showDayPanel, setShowDayPanel] = useState(false);
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [sendingReminder, setSendingReminder] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingCloseId, setPendingCloseId] = useState(null);
  const [doctorApptsCache, setDoctorApptsCache] = useState({});
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [walkInForm, setWalkInForm] = useState({ doctorId: '', patientId: '', reason: '' });
  const [walkInSubmitting, setWalkInSubmitting] = useState(false);
  const [walkInWarnings, setWalkInWarnings] = useState([]);
  const [walkInConfirmOverlap, setWalkInConfirmOverlap] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showQuickPatientForm, setShowQuickPatientForm] = useState(false);
  const [quickPatientForm, setQuickPatientForm] = useState({ firstName: '', lastName: '', phone: '' });
  const [quickPatientSubmitting, setQuickPatientSubmitting] = useState(false);
  const { isAdmin, isDoctor, isReceptionist } = useAuth();
  const canEdit = isAdmin || isDoctor || isReceptionist;
  const tabIdCounter = useRef(0);

  // Persist tabs to localStorage
  const APPT_TABS_KEY = 'appointmentTabs';
  const APPT_ACTIVE_KEY = 'appointmentActiveTabId';

  useEffect(() => {
    try {
      const saved = localStorage.getItem(APPT_TABS_KEY);
      const savedActive = localStorage.getItem(APPT_ACTIVE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Ensure each restored tab has initialForm (backward compat)
          const restored = parsed.map((t) => ({
            ...t,
            initialForm: t.initialForm || { ...t.form },
          }));
          setTabs(restored);
          if (savedActive) {
            const activeId = JSON.parse(savedActive);
            if (restored.some((t) => t.id === activeId)) {
              setActiveTabId(activeId);
            } else {
              setActiveTabId(restored[0].id);
            }
          }
          // Set counter past the max saved ID
          const maxId = restored.reduce((max, t) => Math.max(max, t.id), 0);
          tabIdCounter.current = maxId + 1;
        }
      }
    } catch {
      // Ignore parse errors — just start fresh
    }
  }, []);

  // Debounced save to localStorage + immediate save on tab close/refresh
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(APPT_TABS_KEY, JSON.stringify(tabs));
        localStorage.setItem(APPT_ACTIVE_KEY, JSON.stringify(activeTabId));
      } catch {
        // localStorage might be full
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [tabs, activeTabId]);

  useEffect(() => {
    const save = () => {
      try {
        localStorage.setItem(APPT_TABS_KEY, JSON.stringify(tabs));
        localStorage.setItem(APPT_ACTIVE_KEY, JSON.stringify(activeTabId));
      } catch {}
    };
    window.addEventListener('beforeunload', save);
    return () => window.removeEventListener('beforeunload', save);
  }, [tabs, activeTabId]);

  const openTab = useCallback((initialForm = {}, type = 'create') => {
    const id = ++tabIdCounter.current;
    // Auto-fill date from selected day if not provided
    const defaultForm = {
      doctorId: '', patientId: '', dateTime: '', duration: 30, reason: '',
      ...initialForm,
    };
    if (!defaultForm.dateTime) {
      const y = selectedDate.getFullYear();
      const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const d = String(selectedDate.getDate()).padStart(2, '0');
      defaultForm.dateTime = `${y}-${m}-${d}T09:00`;
    }
    const title = type === 'edit' ? 'Edit Appointment' : 'New Appointment';
    const newTab = { id, title, form: defaultForm, initialForm: { ...defaultForm }, type };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(id);
  }, [selectedDate]);

  const openEditTab = useCallback((appt) => {
    const id = ++tabIdCounter.current;
    const dateTimeLocal = new Date(appt.dateTime);
    const offset = dateTimeLocal.getTimezoneOffset();
    const localISODate = new Date(dateTimeLocal.getTime() - offset * 60000).toISOString().slice(0, 16);
    const form = {
      doctorId: String(appt.doctorId),
      patientId: String(appt.patientId),
      dateTime: localISODate,
      duration: appt.duration || 30,
      reason: appt.reason || '',
    };
    const newTab = { id, title: 'Edit Appointment', form, initialForm: { ...form }, type: 'edit', appointmentId: appt.id };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(id);

    // Pre-fetch doctor's appointments for overlap checking
    const docId = String(appt.doctorId);
    setDoctorApptsCache((prev) => {
      if (prev[docId]) return prev;
      doctorAPI.getAppointments(docId).then((res) => {
        setDoctorApptsCache((p) => ({ ...p, [docId]: { appointments: res.data, loading: false } }));
      }).catch(() => {
        setDoctorApptsCache((p) => ({ ...p, [docId]: { appointments: [], loading: false } }));
      });
      return { ...prev, [docId]: { appointments: [], loading: true } };
    });
  }, []);

  const forceCloseTab = useCallback((id) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      const next = prev.filter((t) => t.id !== id);
      if (next.length === 0) {
        setActiveTabId(null);
      } else {
        setActiveTabId((currentActive) =>
          currentActive === id
            ? next[Math.min(idx, next.length - 1)].id
            : currentActive
        );
      }
      return next;
    });
  }, []);

  const closeTab = useCallback((id, force = false) => {
    // Confirm if the tab has unsaved changes (unless forced)
    if (!force) {
      const tab = tabs.find((t) => t.id === id);
      if (tab && tab.initialForm && JSON.stringify(tab.form) !== JSON.stringify(tab.initialForm)) {
        setPendingCloseId(id);
        return;
      }
    }
    forceCloseTab(id);
  }, [tabs, forceCloseTab]);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const daysInPrevMonth = getDaysInMonth(year, month - 1);

  const appointmentsByDate = useMemo(() => {
    const map = {};
    appointments.forEach((appt) => {
      const key = formatDateKey(new Date(appt.dateTime));
      if (!map[key]) map[key] = [];
      map[key].push(appt);
    });
    return map;
  }, [appointments]);

  const dayAppointments = useMemo(() => {
    const key = formatDateKey(selectedDate);
    return appointmentsByDate[key] || [];
  }, [appointmentsByDate, selectedDate]);

  const fetchAppointments = (start, end) => {
    setLoading(true);
    const params = { start: start.toISOString(), end: end.toISOString(), limit: 200 };
    if (filterStatus) params.status = filterStatus;
    appointmentAPI.getAll(params)
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : res.data.data;
        setAppointments(data);
      })
      .catch(() => toast.error('Failed to load appointments'))
      .finally(() => setLoading(false));
  };

  const refreshCalendar = useCallback(() => {
    const start = new Date(year, month, 1);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(year, month + 1, 0);
    end.setDate(end.getDate() + (6 - end.getDay()));
    end.setHours(23, 59, 59, 999);
    fetchAppointments(start, end);
  }, [year, month, filterStatus]);

  useEffect(() => {
    doctorAPI.getAll().then((res) => setDoctors(res.data)).catch(() => {});
    patientAPI.getAll({}).then((res) => setPatients(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (viewMode === 'list') {
      setLoading(true);
      const params = { page: currentPage, limit: 20, sortBy, sortOrder };
      if (filterStatus) params.status = filterStatus;
      if (dateStart) params.start = new Date(dateStart + 'T00:00:00').toISOString();
      if (dateEnd) params.end = new Date(dateEnd + 'T23:59:59').toISOString();
      if (!dateStart && !dateEnd) {
        // Default: last 30 days
        const d = new Date();
        d.setDate(d.getDate() - 90);
        params.start = d.toISOString();
        params.end = new Date().toISOString();
      }
      appointmentAPI.getAll(params)
        .then((res) => {
          setAppointments(res.data.data);
          setTotalCount(res.data.total);
          setTotalPages(res.data.totalPages);
          setCurrentPage(res.data.page);
        })
        .catch(() => toast.error('Failed to load appointments'))
        .finally(() => setLoading(false));
    } else if (viewMode === 'calendar') {
      refreshCalendar();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth, filterStatus, viewMode, currentPage, sortBy, sortOrder, dateStart, dateEnd, refreshKey]);

  const navigateMonth = (delta) => {
    setCurrentMonth(new Date(year, month + delta, 1));
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

  const handleSubmitTab = async (tab) => {
    // Validate that the date/time is not in the past
    const apptDateTime = new Date(tab.form.dateTime);
    const apptEndTime = new Date(apptDateTime.getTime() + (tab.form.duration || 30) * 60000);
    if (apptEndTime <= new Date()) {
      toast.error('Cannot create an appointment in the past. Please select a future date and time.');
      return;
    }
    // Validate that the selected time is within the doctor's working hours
    if (tab.form.doctorId && tab.form.dateTime) {
      const doc = doctors.find((d) => d.id === parseInt(tab.form.doctorId));
      if (doc?.schedules?.length) {
        const dayOfWeek = new Date(tab.form.dateTime).getDay();
        const schedule = doc.schedules.find((s) => s.dayOfWeek === dayOfWeek);
        const dayName = new Date(tab.form.dateTime).toLocaleDateString('en-US', { weekday: 'long' });
        if (!schedule) {
          toast.error(`Doctor is not available on ${dayName}.`);
          return;
        }
        const date = new Date(tab.form.dateTime);
        const duration = tab.form.duration || 30;
        const endDate = new Date(date.getTime() + duration * 60000);
        const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        const endTimeStr = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
        if (timeStr < schedule.startTime) {
          toast.error(`Selected time (${timeStr}) is before working hours (${schedule.startTime}).`);
          return;
        }
        if (endTimeStr > schedule.endTime) {
          toast.error(`Appointment ends at ${endTimeStr}, which is after working hours (${schedule.endTime}).`);
          return;
        }
      }
    }
    // Check for overlapping appointments before submitting (exclude self for edits)
    const overlapping = getOverlappingAppts(tab.form.doctorId, tab.form.dateTime, tab.form.duration, tab.appointmentId);
    if (overlapping.length > 0) {
      toast.error('This time slot conflicts with an existing appointment. Please choose a different time or doctor.');
      return;
    }
    // Check that the patient doesn't already have an appointment at this time
    if (tab.form.patientId && tab.form.dateTime) {
      const newStart = new Date(tab.form.dateTime);
      const newEnd = new Date(newStart.getTime() + (tab.form.duration || 30) * 60000);
      const patientConflict = appointments.some((a) => {
        if (tab.appointmentId && a.id === tab.appointmentId) return false; // exclude self
        if (String(a.patientId) !== tab.form.patientId) return false;
        if (!['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'].includes(a.status)) return false;
        const aStart = new Date(a.dateTime);
        const aEnd = new Date(aStart.getTime() + (a.duration || 30) * 60000);
        return newStart < aEnd && newEnd > aStart;
      });
      if (patientConflict) {
        toast.error('This patient already has an appointment at this time with another doctor.');
        return;
      }
    }
    setSubmitting(true);
    try {
      if (tab.type === 'edit') {
        await appointmentAPI.update(tab.appointmentId, tab.form);
        toast.success('Appointment updated');
      } else {
        await appointmentAPI.create(tab.form);
        toast.success('Appointment created');
      }
      closeTab(tab.id, true);
      refreshCalendar();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save appointment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await appointmentAPI.update(id, { status });
      toast.success(`Appointment ${status.toLowerCase().replace('_', ' ')}`);
      refreshCalendar();
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
  for (let i = firstDay - 1; i >= 0; i--) {
    calendarDays.push({ day: daysInPrevMonth - i, date: new Date(year, month - 1, daysInPrevMonth - i), isCurrentMonth: false });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push({ day: i, date: new Date(year, month, i), isCurrentMonth: true });
  }
  const remaining = 7 - (calendarDays.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      calendarDays.push({ day: i, date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
  }

  const today = new Date();
  const isTodayFn = (date) => isSameDay(date, today);
  const isSelectedFn = (date) => isSameDay(date, selectedDate);

  const getApptsForDate = (date) => {
    const key = formatDateKey(date);
    return appointmentsByDate[key] || [];
  };

  const countByStatus = (appts) => {
    const counts = {};
    appts.forEach((a) => { counts[a.status] = (counts[a.status] || 0) + 1; });
    return counts;
  };

  // Compute overlapping appointments for a given doctor/dateTime/duration
  const getOverlappingAppts = useCallback((doctorId, dateTime, duration, excludeId) => {
    if (!doctorId || !dateTime) return [];
    const doctorAppts = doctorApptsCache[doctorId]?.appointments;
    if (!doctorAppts) return [];

    const newStart = new Date(dateTime);
    const newEnd = new Date(newStart.getTime() + (duration || 30) * 60000);

    return doctorAppts.filter((existing) => {
      // Skip the appointment being edited (self-overlap)
      if (excludeId && existing.id === excludeId) return false;
      const existingStart = new Date(existing.dateTime);
      const existingEnd = new Date(existingStart.getTime() + (existing.duration || 30) * 60000);
      // Check if the new time overlaps with the existing appointment
      return newStart < existingEnd && newEnd > existingStart;
    });
  }, [doctorApptsCache]);

  const renderAppointmentForm = (tab, onFieldChange) => {
    const overlapping = getOverlappingAppts(tab.form.doctorId, tab.form.dateTime, tab.form.duration, tab.appointmentId);
    const selectedDoctorAppts = tab.form.doctorId ? doctorApptsCache[tab.form.doctorId] : null;

    return (
      <div className="max-w-md space-y-4">
        <div>
          <label className="label">Doctor *</label>
          <select
            className="input"
            value={tab.form.doctorId}
            onChange={(e) => {
              const newDoctorId = e.target.value;
              onFieldChange({ ...tab.form, doctorId: newDoctorId });
              // Fetch doctor's appointments if not cached
              if (newDoctorId && !doctorApptsCache[newDoctorId]) {
                setDoctorApptsCache((prev) => ({ ...prev, [newDoctorId]: { appointments: [], loading: true } }));
                doctorAPI.getAppointments(newDoctorId)
                  .then((res) => {
                    setDoctorApptsCache((prev) => ({ ...prev, [newDoctorId]: { appointments: res.data, loading: false } }));
                  })
                  .catch(() => {
                    setDoctorApptsCache((prev) => ({ ...prev, [newDoctorId]: { appointments: [], loading: false } }));
                  });
              }
            }}
            required
          >
            <option value="">Select doctor...</option>
            {doctors.map((d) => <option key={d.id} value={d.id}>{d.user?.name} - {d.specialization}</option>)}
          </select>
          {selectedDoctorAppts?.loading && (
            <p className="text-xs mt-1 text-gray-400 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading doctor's schedule...
            </p>
          )}

          {/* Doctor Working Hours */}
          {tab.form.doctorId && tab.form.dateTime && (() => {
            const doc = doctors.find((d) => d.id === parseInt(tab.form.doctorId));
            if (!doc?.schedules?.length) return null;
            const dayOfWeek = new Date(tab.form.dateTime).getDay();
            const schedule = doc.schedules.find((s) => s.dayOfWeek === dayOfWeek);
            const dayName = new Date(tab.form.dateTime).toLocaleDateString('en-US', { weekday: 'long' });

            if (!schedule) {
              return (
                <div className="rounded-lg p-3 bg-amber-50 border border-amber-200 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="text-amber-700 font-medium">
                      Doctor is not available on {dayName}
                    </span>
                  </div>
                </div>
              );
            }

            const date = new Date(tab.form.dateTime);
            const duration = tab.form.duration || 30;
            const endDate = new Date(date.getTime() + duration * 60000);
            const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
            const endTimeStr = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
            const inHours = timeStr >= schedule.startTime && endTimeStr <= schedule.endTime;

            return (
              <div className={`rounded-lg p-3 text-sm border ${inHours ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                <div className="flex items-center gap-2">
                  <Clock className={`w-4 h-4 shrink-0 ${inHours ? 'text-emerald-500' : 'text-amber-500'}`} />
                  <span className={inHours ? 'text-emerald-700' : 'text-amber-700'}>
                    Working hours: {schedule.startTime} - {schedule.endTime} ({dayName})
                  </span>
                </div>
                {!inHours && (
                  <p className="text-xs text-amber-600 mt-1 ml-6">
                    {timeStr < schedule.startTime
                      ? `Selected time (${timeStr}) is before working hours (${schedule.startTime}).`
                      : `Appointment ends at ${endTimeStr}, which is after working hours (${schedule.endTime}).`}
                  </p>
                )}
              </div>
            );
          })()}
        </div>
        <div>
          <label className="label">Patient *</label>
          <select className="input" value={tab.form.patientId} onChange={(e) => onFieldChange({ ...tab.form, patientId: e.target.value })} required>
            <option value="">Select patient...</option>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} - {p.phone}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Date & Time *</label>
          <input type="datetime-local" className="input" value={tab.form.dateTime} onChange={(e) => onFieldChange({ ...tab.form, dateTime: e.target.value })} min={(() => { const n = new Date(); return new Date(n.getTime() - n.getTimezoneOffset() * 60000).toISOString().slice(0, 16); })()} required />
        </div>
        <div>
          <label className="label">Duration (minutes)</label>
          <input type="number" className="input" value={tab.form.duration} onChange={(e) => onFieldChange({ ...tab.form, duration: parseInt(e.target.value) || 30 })} min={15} step={15} />
        </div>
        <div>
          <label className="label">Reason</label>
          <textarea className="input" rows={2} value={tab.form.reason} onChange={(e) => onFieldChange({ ...tab.form, reason: e.target.value })} />
        </div>

        {/* Overlap Warning */}
        {overlapping.length > 0 && (
          <div className="rounded-lg p-3 bg-red-50 border border-red-200 text-sm">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span className="font-medium text-red-700">
                {overlapping.length === 1
                  ? '1 overlapping appointment found'
                  : `${overlapping.length} overlapping appointments found`}
              </span>
            </div>
            <p className="text-xs text-red-600 mb-2">
              The selected doctor already has appointment(s) during this time slot.
            </p>
            <div className="space-y-1.5">
              {overlapping.map((appt) => (
                <div key={appt.id} className="flex items-center justify-between text-xs bg-white rounded px-2 py-1.5 border border-red-100">
                  <span className="font-medium text-red-700">{appt.patient?.firstName} {appt.patient?.lastName}</span>
                  <span className="text-red-500">{formatTime(appt.dateTime)} ({appt.duration || 30} min)</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
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
            <>
              <button onClick={() => { setWalkInForm({ doctorId: '', patientId: '', reason: '' }); setWalkInWarnings([]); setWalkInConfirmOverlap(false); setShowQuickPatientForm(false); setQuickPatientForm({ firstName: '', lastName: '', phone: '' }); setShowWalkInModal(true); }} className="btn-walkin">
                <Zap className="w-4 h-4" />
                Walk-in
              </button>
              <button onClick={() => openTab()} className="btn-primary">
                <Plus className="w-4 h-4" />
                New Appointment
              </button>
            </>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="card px-4 py-3">
        <div className="flex flex-wrap items-center gap-y-3 gap-x-4">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }} role="tablist" aria-label="View mode">
              <button type="button" role="tab" aria-selected={viewMode === 'calendar'} onClick={() => setViewMode('calendar')}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all duration-150 ${viewMode === 'calendar'
                  ? 'text-white shadow-sm' : 'hover:bg-black/5 text-gray-500'}`}
                style={{
                  backgroundColor: viewMode === 'calendar' ? 'var(--btn-primary-bg)' : 'transparent',
                }}
              >
                <Grid3X3 className="w-3.5 h-3.5" /> Calendar
              </button>
              <button type="button" role="tab" aria-selected={viewMode === 'list'} onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all duration-150 ${viewMode === 'list'
                  ? 'text-white shadow-sm' : 'hover:bg-black/5 text-gray-500'}`}
                style={{
                  backgroundColor: viewMode === 'list' ? 'var(--btn-primary-bg)' : 'transparent',
                }}
              >
                <List className="w-3.5 h-3.5" /> List
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px h-6" style={{ backgroundColor: 'var(--border)' }} />

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
              <select
                className="pl-8 pr-7 py-2 rounded-lg text-xs font-medium appearance-none cursor-pointer transition-all duration-150"
                style={{
                  backgroundColor: filterStatus ? 'var(--primary-50)' : 'var(--surface)',
                  border: '1px solid ' + (filterStatus ? 'var(--primary-300)' : 'var(--border)'),
                  color: filterStatus ? 'var(--primary-700)' : 'var(--text-secondary)',
                }}
                value={filterStatus}
                onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
              >
                <option value="">All Statuses</option>
                {statuses.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
              {filterStatus && (
                <button type="button"
                  onClick={() => { setFilterStatus(''); setCurrentPage(1); }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-black/10 transition-colors"
                  aria-label="Clear status filter"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Calendar View Controls */}
          {viewMode === 'calendar' && (
            <>
              <div className="hidden sm:block w-px h-6" style={{ backgroundColor: 'var(--border)' }} />
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={goToToday} className="px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 hover:shadow-sm"
                  style={{
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-label)',
                  }}
                >
                  Today
                </button>
                <div className="flex items-center gap-0.5 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  <button type="button" onClick={() => navigateMonth(-1)} className="p-1.5 transition-colors hover:bg-gray-100/50" style={{ color: 'var(--text-muted)' }} aria-label="Previous month">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-1.5 text-sm font-semibold min-w-[150px] text-center select-none" style={{ color: 'var(--text-body)' }}>
                    {MONTH_NAMES[month]} {year}
                  </span>
                  <button type="button" onClick={() => navigateMonth(1)} className="p-1.5 transition-colors hover:bg-gray-100/50" style={{ color: 'var(--text-muted)' }} aria-label="Next month">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* List View Controls */}
          {viewMode === 'list' && (
            <>
              <div className="hidden sm:block w-px h-6" style={{ backgroundColor: 'var(--border)' }} />
              {/* Sort Controls */}
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1 px-2 py-2 rounded-lg" style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
                  <SlidersHorizontal className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                  <select
                    className="text-xs bg-transparent border-none outline-none cursor-pointer font-medium py-0 px-1"
                    style={{ color: 'var(--text-label)' }}
                    value={sortBy}
                    onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
                  >
                    <option value="dateTime">Date</option>
                    <option value="status">Status</option>
                    <option value="duration">Duration</option>
                    <option value="createdAt">Created</option>
                  </select>
                  <button type="button"
                    onClick={() => { setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc')); setCurrentPage(1); }}
                    className="p-0.5 rounded transition-colors hover:bg-gray-100/50"
                    style={{ color: 'var(--text-muted)' }}
                    title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                    aria-label={sortOrder === 'asc' ? 'Sort ascending' : 'Sort descending'}
                  >
                    {sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Date Range */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg" style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
                  <CalendarRange className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="date"
                    className="text-xs bg-transparent border-none outline-none w-[132px]"
                    style={{ color: 'var(--text-body)' }}
                    value={dateStart}
                    onChange={(e) => { setDateStart(e.target.value); setCurrentPage(1); }}
                    title="Start date"
                    aria-label="Start date"
                  />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
                  <input
                    type="date"
                    className="text-xs bg-transparent border-none outline-none w-[132px]"
                    style={{ color: 'var(--text-body)' }}
                    value={dateEnd}
                    onChange={(e) => { setDateEnd(e.target.value); setCurrentPage(1); }}
                    title="End date"
                    aria-label="End date"
                  />
                </div>
              </div>

              {/* Clear Filters */}
              {(dateStart || dateEnd || filterStatus || sortBy !== 'dateTime' || sortOrder !== 'asc') && (
                <button type="button"
                  onClick={() => {
                    setDateStart('');
                    setDateEnd('');
                    setFilterStatus('');
                    setSortBy('dateTime');
                    setSortOrder('asc');
                    setCurrentPage(1);
                  }}
                  className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-medium transition-all duration-150 hover:bg-gray-100/50 hover:border-solid"
                  style={{
                    color: 'var(--text-muted)',
                    border: '1px dashed var(--border)',
                  }}
                  aria-label="Reset all filters"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div className="flex gap-6">
          <div className="flex-1 min-w-0">
            <div className="card overflow-hidden">
              <div className="grid grid-cols-7 border-b border-gray-100">
                {DAY_NAMES.map((name) => (
                  <div key={name} className="px-2 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{name}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {calendarDays.map((dayData, idx) => {
                  const appts = getApptsForDate(dayData.date);
                  const statusCounts = countByStatus(appts);
                  const hasAppts = appts.length > 0;
                  return (
                    <button key={idx} onClick={() => handleDayClick(dayData.date)}
                      className={`relative min-h-[90px] p-1.5 border-b border-r border-gray-100 text-left transition-colors hover:bg-gray-100/50 ${!dayData.isCurrentMonth ? 'bg-gray-100/30' : ''} ${isSelectedFn(dayData.date) ? 'ring-2 ring-primary-500 ring-inset z-10 bg-primary-50/50' : ''} ${isTodayFn(dayData.date) ? 'ring-2 ring-primary-500 ring-inset' : ''}`}
                    >
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium ${isTodayFn(dayData.date) ? 'bg-btn-primary text-gray-900' : isSelectedFn(dayData.date) ? 'bg-btn-primary text-gray-900' : dayData.isCurrentMonth ? 'text-gray-900' : 'text-gray-500'}`}>
                        {dayData.day}
                      </span>
                      {hasAppts && (
                        <div className="mt-1 space-y-0.5">
                          {Object.entries(statusCounts).slice(0, 3).map(([status, count]) => (
                            <div key={status} className={`flex items-center gap-1 px-1 py-0.5 rounded ${STATUS_COLORS[status]?.bg || 'bg-gray-100'}`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[status]?.dot || 'bg-gray-500'}`} />
                              <span className="text-[10px] font-medium text-gray-600 truncate">{count} {status.replace('_', ' ')}</span>
                            </div>
                          ))}
                          {appts.length > 3 && <span className="text-[10px] pl-1" style={{ color: 'var(--text-muted)' }}>+{appts.length - 3} more</span>}
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
                    <h3 className="font-semibold text-gray-900 text-sm">{selectedDate.toLocaleDateString('en-US', { weekday: 'long' })}</h3>
                    <p className="text-xs text-gray-500">{selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                  </div>
                  <button onClick={() => setShowDayPanel(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
                </div>
    <div className="p-4 space-y-4">
                  {loading ? (
                    <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary-600" /></div>
                  ) : dayAppointments.length === 0 ? (
                    <div className="text-center py-6">
                      <Calendar className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                      <p className="text-sm text-gray-400 mb-3">No appointments on this day</p>
                      {canEdit && (
                        <button onClick={() => openTab()} className="btn-sm btn-primary"><Plus className="w-3 h-3" /> Book Appointment</button>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Waiting Room — walk-ins currently in progress */}
                      {(() => {
                        const walkIns = dayAppointments.filter((a) => a.type === 'WALK_IN' && a.status === 'IN_PROGRESS');
                        if (walkIns.length === 0) return null;
                        return (
                          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--primary-200)', backgroundColor: 'var(--primary-50)' }}>
                            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-primary-200">
                              <Activity className="w-3.5 h-3.5 text-amber-500" />
                              <span className="text-xs font-semibold text-gray-700">Waiting Room</span>
                              <span className="text-[10px] font-medium text-gray-500 ml-auto">{walkIns.length} walk-in{walkIns.length > 1 ? 's' : ''}</span>
                            </div>
                            <div className="divide-y divide-primary-200">
                              {walkIns.map((appt) => (
                                <div key={appt.id} className="px-3 py-2 flex items-center gap-2 hover:bg-white/50 transition-colors">
                                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-medium text-gray-800">{appt.patient?.firstName} {appt.patient?.lastName}</span>
                                      {appt.reason && <span className="text-[10px] text-gray-500 truncate">— {appt.reason}</span>}
                                    </div>
                                    <p className="text-[10px] text-gray-500">Dr. {appt.doctor?.user?.name} · {formatTime(appt.dateTime)}</p>
                                  </div>
                                  <button onClick={() => handleStatusChange(appt.id, 'COMPLETED')} className="text-[10px] px-2 py-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded font-medium whitespace-nowrap transition-colors">Complete</button>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      <div className="space-y-2">
                        {dayAppointments.map((appt) => (
                          <div key={appt.id} className={`rounded-lg border-l-4 ${STATUS_COLORS[appt.status]?.border || 'border-l-gray-500'} bg-white border border-gray-200 border-l-4 p-3 hover:shadow-sm transition-shadow`}>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-sm font-medium text-gray-900 truncate">{appt.patient?.firstName} {appt.patient?.lastName}</span>
                                {appt.type === 'WALK_IN' && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
                                    <Zap className="w-2.5 h-2.5" /> Walk-in
                                  </span>
                                )}
                              </div>
                              <span className={`badge text-[10px] ${getStatusBadge(appt.status)}`}>{appt.status.replace('_', ' ')}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1"><Clock className="w-3 h-3" /> {formatTime(appt.dateTime)} ({appt.duration} min)</div>
                            <p className="text-xs text-gray-500">Dr. {appt.doctor?.user?.name}</p>
                            {appt.reason && <p className="text-xs text-gray-400 mt-1 truncate">{appt.reason}</p>}
                            <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-gray-100">
                              {(appt.status === 'SCHEDULED' || appt.status === 'CONFIRMED') && (
                                <button disabled={sendingReminder === appt.id} onClick={async (e) => { e.stopPropagation(); setSendingReminder(appt.id); try { const res = await reminderAPI.sendForAppointment(appt.id); toast.success(res.data.message || 'Reminder sent!'); } catch (err) { toast.error(err.response?.data?.error || 'Failed to send reminder'); } finally { setSendingReminder(null); } }} className="btn-sm text-[10px] px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded">
                                  <Send className="w-3 h-3" /> {sendingReminder === appt.id ? '...' : 'Remind'}
                                </button>
                              )}
                              {(appt.status === 'SCHEDULED' || appt.status === 'CONFIRMED') && (
                                <button onClick={(e) => { e.stopPropagation(); openEditTab(appt); }} className="btn-sm text-[10px] px-2 py-1 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 rounded">
                                  <Pencil className="w-3 h-3" />
                                </button>
                              )}
                              {appt.status === 'SCHEDULED' && (<><button onClick={() => handleStatusChange(appt.id, 'CONFIRMED')} className="btn-sm text-[10px] px-2 py-1 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 rounded">Confirm</button><button onClick={() => handleStatusChange(appt.id, 'CANCELLED')} className="btn-sm text-[10px] px-2 py-1 bg-white text-red-600 border border-red-200 hover:bg-red-50 rounded">Cancel</button></>)}
                              {appt.status === 'CONFIRMED' && <button onClick={() => handleStatusChange(appt.id, 'IN_PROGRESS')} className="btn-sm text-[10px] px-2 py-1 bg-primary-50 text-primary-700 hover:bg-primary-100 rounded">Start</button>}
                              {appt.status === 'IN_PROGRESS' && appt.type !== 'WALK_IN' && <button onClick={() => handleStatusChange(appt.id, 'COMPLETED')} className="btn-sm text-[10px] px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded">Complete</button>}
                            </div>
                          </div>
                        ))}
                        {canEdit && (
                          <button onClick={() => openTab()} className="btn-sm btn-secondary w-full mt-2"><Plus className="w-3 h-3" /> Add Appointment</button>
                        )}
                      </div>
                    </>
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
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary-600" /></div>
          ) : appointments.length === 0 ? (
            <div className="text-center py-12 text-gray-400"><Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>No appointments found</p></div>
          ) : (
            <>
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
                    {appointments.map((appt) => {
                      const isWalkIn = appt.type === 'WALK_IN';
                      return (
                        <tr key={appt.id} className={`border-t border-gray-100 hover:bg-gray-50 ${isWalkIn ? 'bg-amber-50/40' : ''}`}>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-gray-900">{appt.patient?.firstName} {appt.patient?.lastName}</span>
                              {isWalkIn && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
                                  <Zap className="w-2.5 h-2.5" /> Walk-in
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-gray-600">{appt.doctor?.user?.name}</td>
                          <td className="px-5 py-3 text-gray-600 whitespace-nowrap"><div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-gray-400" /> {formatDate(appt.dateTime)} {formatTime(appt.dateTime)}</div></td>
                          <td className="px-5 py-3 text-gray-600">{appt.duration} min</td>
                          <td className="px-5 py-3 text-gray-500 max-w-[200px] truncate">{appt.reason || '-'}</td>
                          <td className="px-5 py-3"><span className={`badge ${getStatusBadge(appt.status)}`}>{appt.status.replace('_', ' ')}</span></td>
                          <td className="px-5 py-3">
                            {canEdit && (
                              <div className="flex flex-wrap gap-1">
                                {(appt.status === 'SCHEDULED' || appt.status === 'CONFIRMED') && (
                                  <button disabled={sendingReminder === appt.id} onClick={async () => { setSendingReminder(appt.id); try { const res = await reminderAPI.sendForAppointment(appt.id); toast.success(res.data.message || 'Reminder sent!'); } catch (err) { toast.error(err.response?.data?.error || 'Failed to send reminder'); } finally { setSendingReminder(null); } }} className="btn-sm btn-remind" title="Send WhatsApp reminder">{sendingReminder === appt.id ? 'Sending...' : 'Remind'}</button>
                                )}
                                {(appt.status === 'SCHEDULED' || appt.status === 'CONFIRMED') && (
                                  <button onClick={() => openEditTab(appt)} className="btn-sm btn-secondary" title="Edit appointment"><Pencil className="w-3 h-3" /></button>
                                )}
                                {appt.status === 'SCHEDULED' && (<><button onClick={() => handleStatusChange(appt.id, 'CONFIRMED')} className="btn-sm btn-secondary">Confirm</button><button onClick={() => handleStatusChange(appt.id, 'CANCELLED')} className="btn-sm btn-danger">Cancel</button></>)}
                                {appt.status === 'CONFIRMED' && <button onClick={() => handleStatusChange(appt.id, 'IN_PROGRESS')} className="btn-sm btn-primary">Start</button>}
                                {appt.status === 'IN_PROGRESS' && !isWalkIn && <button onClick={() => handleStatusChange(appt.id, 'COMPLETED')} className="btn-sm btn-primary">Complete</button>}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
                  <span className="text-xs text-gray-500">
                    {((currentPage - 1) * 20) + 1}&ndash;{Math.min(currentPage * 20, totalCount)} of {totalCount}
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {(() => {
                      const pages = [];
                      for (let i = 1; i <= totalPages; i++) {
                        if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) {
                          pages.push(i);
                        }
                      }
                      return pages.flatMap((p, idx, arr) => {
                        const elements = [];
                        if (idx > 0 && arr[idx - 1] !== p - 1) {
                          elements.push(<span key={`e-${p}`} className="px-1 text-gray-400 text-xs">...</span>);
                        }
                        elements.push(
                          <button key={p} onClick={() => setCurrentPage(p)} className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${p === currentPage ? 'bg-btn-primary text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}>
                            {p}
                          </button>
                        );
                        return elements;
                      });
                    })()}
                    <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Walk-in Modal */}
      {showWalkInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowWalkInModal(false)} />
          <div className="relative w-full max-w-lg mx-4 card p-6 shadow-xl" style={{ backgroundColor: 'var(--surface)' }}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold" style={{ color: 'var(--text-body)' }}>Walk-in Appointment</h3>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Check in an urgent patient immediately</p>
                </div>
              </div>
              <button onClick={() => setShowWalkInModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100" style={{ color: 'var(--text-muted)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">Doctor *</label>
                <select className="input" value={walkInForm.doctorId} onChange={(e) => { setWalkInForm({ ...walkInForm, doctorId: e.target.value }); setWalkInWarnings([]); setWalkInConfirmOverlap(false); }} required>
                  <option value="">Select doctor...</option>
                  {doctors.map((d) => <option key={d.id} value={d.id}>{d.user?.name} - {d.specialization}{d.consultationFee ? ` ($${d.consultationFee})` : ''}</option>)}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">Patient *</label>
                  {!showQuickPatientForm && (
                    <button type="button" onClick={() => setShowQuickPatientForm(true)} className="text-xs font-medium flex items-center gap-1 px-2 py-1 rounded transition-colors hover:bg-gray-100" style={{ color: 'var(--primary-600)' }}>
                      <Plus className="w-3 h-3" /> New Patient
                    </button>
                  )}
                </div>

                {showQuickPatientForm ? (
                  <div className="space-y-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--gray-50)', border: '1px solid var(--border)' }}>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label text-xs">First Name *</label>
                        <input type="text" className="input text-sm" value={quickPatientForm.firstName}
                          onChange={(e) => setQuickPatientForm({ ...quickPatientForm, firstName: e.target.value })}
                          placeholder="First name" />
                      </div>
                      <div>
                        <label className="label text-xs">Last Name *</label>
                        <input type="text" className="input text-sm" value={quickPatientForm.lastName}
                          onChange={(e) => setQuickPatientForm({ ...quickPatientForm, lastName: e.target.value })}
                          placeholder="Last name" />
                      </div>
                    </div>
                    <div>
                      <label className="label text-xs">Phone *</label>
                      <input type="text" className="input text-sm" value={quickPatientForm.phone}
                        onChange={(e) => setQuickPatientForm({ ...quickPatientForm, phone: e.target.value })}
                        placeholder="Phone number" />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button type="button" onClick={() => { setShowQuickPatientForm(false); setQuickPatientForm({ firstName: '', lastName: '', phone: '' }); }}
                        className="btn-sm btn-secondary text-xs">Cancel</button>
                      <button type="button" disabled={!quickPatientForm.firstName || !quickPatientForm.lastName || !quickPatientForm.phone || quickPatientSubmitting}
                        onClick={async () => {
                          if (!quickPatientForm.firstName || !quickPatientForm.lastName || !quickPatientForm.phone) return;
                          setQuickPatientSubmitting(true);
                          try {
                            const res = await patientAPI.create(quickPatientForm);
                            const newPatient = res.data;
                            // Refresh patients list and select the new one
                            const patientsRes = await patientAPI.getAll({});
                            setPatients(patientsRes.data);
                            setWalkInForm((prev) => ({ ...prev, patientId: String(newPatient.id) }));
                            setWalkInWarnings([]);
                            setWalkInConfirmOverlap(false);
                            setShowQuickPatientForm(false);
                            setQuickPatientForm({ firstName: '', lastName: '', phone: '' });
                            toast.success('Patient created and selected');
                          } catch (error) {
                            toast.error(error.response?.data?.message || 'Failed to create patient');
                          } finally {
                            setQuickPatientSubmitting(false);
                          }
                        }}
                        className="btn-sm text-xs" style={{ backgroundColor: 'var(--btn-primary-bg)', color: 'white' }}
                      >
                        {quickPatientSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                        {quickPatientSubmitting ? 'Saving...' : 'Save & Select'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <select className="input" value={walkInForm.patientId} onChange={(e) => { setWalkInForm({ ...walkInForm, patientId: e.target.value }); setWalkInWarnings([]); setWalkInConfirmOverlap(false); }} required>
                    <option value="">Select patient...</option>
                    {patients.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} - {p.phone}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="label">Reason / Symptoms</label>
                <textarea className="input" rows={2} value={walkInForm.reason} onChange={(e) => setWalkInForm({ ...walkInForm, reason: e.target.value })} placeholder="e.g. chest pain, high fever, injury..." />
              </div>

              {/* Auto-info card */}
              <div className="rounded-lg p-3 text-xs space-y-1" style={{ backgroundColor: 'var(--gray-50)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-1.5 font-medium" style={{ color: 'var(--text-label)' }}>
                  <Clock className="w-3.5 h-3.5" />
                  Will be created for <strong>right now</strong>
                </div>
                <p style={{ color: 'var(--text-muted)' }}>Status will be set to <strong>In Progress</strong></p>
                {doctors.find((d) => d.id === parseInt(walkInForm.doctorId))?.consultationFee && (
                  <p style={{ color: 'var(--text-muted)' }}>
                    Invoice will be auto-created for <strong>${doctors.find((d) => d.id === parseInt(walkInForm.doctorId)).consultationFee}</strong>
                  </p>
                )}
              </div>

              {/* Warnings */}
              {walkInWarnings.length > 0 && (
                <div className="rounded-lg p-3 bg-amber-50 border border-amber-200 text-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="font-medium text-amber-700">Schedule conflict detected</span>
                  </div>
                  <ul className="text-xs text-amber-600 space-y-1">
                    {walkInWarnings.map((w, i) => <li key={i}>• {w.message}</li>)}
                  </ul>
                  {!walkInConfirmOverlap && (
                    <button onClick={() => setWalkInConfirmOverlap(true)} className="mt-2 text-xs font-medium text-amber-700 underline hover:no-underline">
                      Proceed anyway
                    </button>
                  )}
                  {walkInConfirmOverlap && (
                    <p className="mt-1 text-xs font-medium text-amber-700">✓ You confirmed — will create despite the conflict</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => setShowWalkInModal(false)} className="btn-secondary text-sm">Cancel</button>
              <button
                disabled={!walkInForm.doctorId || !walkInForm.patientId || walkInSubmitting}
                onClick={async () => {
                  if (!walkInForm.doctorId || !walkInForm.patientId) return;
                  setWalkInSubmitting(true);
                  try {
                    const res = await appointmentAPI.createWalkIn({
                      doctorId: walkInForm.doctorId,
                      patientId: walkInForm.patientId,
                      reason: walkInForm.reason || 'Walk-in',
                      confirmOverlap: walkInConfirmOverlap,
                    });
                    const { warnings } = res.data;
                    // If there are warnings and user hasn't confirmed, show warnings (appointment wasn't created)
                    if (warnings && warnings.length > 0 && !walkInConfirmOverlap) {
                      setWalkInWarnings(warnings);
                      setWalkInSubmitting(false);
                      return;
                    }
                    setShowWalkInModal(false);
                    const msgParts = ['Walk-in checked in successfully'];
                    if (res.data.invoice) {
                      msgParts.push(`Invoice created for $${res.data.invoice.amount.toFixed(2)}`);
                    }
                    toast.success(msgParts.join(' — '));
                    refreshCalendar();
                    setRefreshKey((k) => k + 1);
                  } catch (error) {
                    toast.error(error.response?.data?.message || 'Failed to create walk-in');
                  } finally {
                    setWalkInSubmitting(false);
                  }
                }}
                className="btn-walkin text-sm"
              >
                {walkInSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {walkInSubmitting ? 'Checking in...' : 'Check-in Walk-in'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-tab Form Panel */}
      <MultiTabForm
        tabs={tabs}
        activeId={activeTabId}
        onSelect={setActiveTabId}
        onClose={closeTab}
        onFormChange={(id, newForm) => {
          setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, form: newForm } : t)));
        }}
        renderForm={renderAppointmentForm}
        onSubmit={handleSubmitTab}
        submitLabel={tabs.find((t) => t.id === activeTabId)?.type === 'edit' ? 'Update Appointment' : 'Create Appointment'}
        submitting={submitting}
      />

      {/* Unsaved Changes Confirm Modal */}
      <ConfirmModal
        open={pendingCloseId !== null}
        title="Unsaved Changes"
        message="You have unsaved changes in this form. Are you sure you want to discard them?"
        confirmLabel="Discard Changes"
        cancelLabel="Keep Editing"
        variant="warning"
        onConfirm={() => {
          const id = pendingCloseId;
          setPendingCloseId(null);
          forceCloseTab(id);
        }}
        onCancel={() => setPendingCloseId(null)}
      />
    </div>
  );
}
