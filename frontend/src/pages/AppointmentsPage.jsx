import { useState, useEffect } from 'react';
import { appointmentAPI, doctorAPI, patientAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  Calendar,
  Plus,
  Search,
  Clock,
  Loader2,
  X,
  Filter,
} from 'lucide-react';
import toast from 'react-hot-toast';

const statuses = ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ doctorId: '', patientId: '', dateTime: '', duration: 30, reason: '' });
  const { isAdmin, isDoctor, isReceptionist } = useAuth();
  const canEdit = isAdmin || isDoctor || isReceptionist;

  const fetchData = () => {
    setLoading(true);
    const params = {};
    if (filter) params.status = filter;
    if (dateFilter) params.date = dateFilter;

    Promise.all([
      appointmentAPI.getAll(params),
      doctorAPI.getAll(),
      patientAPI.getAll({}),
    ])
      .then(([apptRes, docRes, patRes]) => {
        setAppointments(apptRes.data);
        setDoctors(docRes.data);
        setPatients(patRes.data);
      })
      .catch(() => toast.error('Failed to load data'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [filter, dateFilter]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await appointmentAPI.create(form);
      toast.success('Appointment created');
      setShowModal(false);
      setForm({ doctorId: '', patientId: '', dateTime: '', duration: 30, reason: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create appointment');
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await appointmentAPI.update(id, { status });
      toast.success(`Appointment ${status.toLowerCase().replace('_', ' ')}`);
      fetchData();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      SCHEDULED: 'bg-blue-100 text-blue-700',
      CONFIRMED: 'bg-indigo-100 text-indigo-700',
      IN_PROGRESS: 'bg-amber-100 text-amber-700',
      COMPLETED: 'bg-emerald-100 text-emerald-700',
      CANCELLED: 'bg-red-100 text-red-700',
      NO_SHOW: 'bg-gray-100 text-gray-700',
    };
    return styles[status] || styles.SCHEDULED;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
          <p className="text-gray-500 mt-1">Schedule and manage patient appointments</p>
        </div>
        {canEdit && (
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            New Appointment
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select className="input pl-10 pr-8" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All Statuses</option>
            {statuses.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
        <div>
          <input
            type="date"
            className="input"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </div>
      </div>

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
        <div className="card overflow-hidden">
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
                    <td className="px-5 py-3 text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        {new Date(appt.dateTime).toLocaleDateString()} {new Date(appt.dateTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
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
                        <div className="flex gap-1">
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
