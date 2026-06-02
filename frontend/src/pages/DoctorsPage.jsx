import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { doctorAPI, departmentAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  Stethoscope,
  Plus,
  Search,
  Mail,
  Phone,
  Building2,
  Loader2,
  Edit2,
  Trash2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    specialization: '',
    licenseNumber: '',
    bio: '',
    consultationFee: '',
  });
  const { isAdmin } = useAuth();

  const fetchDoctors = () => {
    setLoading(true);
    doctorAPI
      .getAll()
      .then((res) => setDoctors(res.data))
      .catch(() => toast.error('Failed to load doctors'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDoctors();
    departmentAPI.getAll().then((res) => setDepartments(res.data)).catch(() => {});
  }, []);

  const filtered = doctors.filter(
    (d) =>
      d.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
      d.specialization?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await doctorAPI.update(editing.id, form);
        toast.success('Doctor updated successfully');
      } else {
        await doctorAPI.create({ ...form, consultationFee: form.consultationFee ? parseFloat(form.consultationFee) : null });
        toast.success('Doctor created successfully');
      }
      setShowModal(false);
      setEditing(null);
      setForm({ name: '', email: '', password: '', specialization: '', licenseNumber: '', bio: '', consultationFee: '' });
      fetchDoctors();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Operation failed');
    }
  };

  const handleEdit = (doctor) => {
    setEditing(doctor);
    setForm({
      name: doctor.user?.name || '',
      email: doctor.user?.email || '',
      password: '',
      specialization: doctor.specialization || '',
      licenseNumber: doctor.licenseNumber || '',
      bio: doctor.bio || '',
      consultationFee: doctor.consultationFee?.toString() || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this doctor?')) return;
    try {
      await doctorAPI.delete(id);
      toast.success('Doctor deleted successfully');
      fetchDoctors();
    } catch (error) {
      toast.error('Failed to delete doctor');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Doctors</h1>
          <p className="text-gray-500 mt-1">Manage doctor profiles and schedules</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => {
              setEditing(null);
              setForm({ name: '', email: '', password: '', specialization: '', licenseNumber: '', bio: '', consultationFee: '' });
              setShowModal(true);
            }}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            Add Doctor
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search doctors..."
          className="input pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Doctors Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Stethoscope className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No doctors found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((doctor) => (
            <Link
              key={doctor.id}
              to={`/doctors/${doctor.id}`}
              className="card p-5 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary-100 text-primary-700 text-lg font-semibold">
                    {doctor.user?.name?.charAt(0) || 'D'}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                      {doctor.user?.name}
                    </h3>
                    <p className="text-sm text-primary-600">{doctor.specialization}</p>
                  </div>
                </div>
                <span className="badge bg-green-100 text-green-700">
                  {doctor._count?.appointments || 0} appts
                </span>
              </div>

              <div className="mt-4 space-y-2">
                {doctor.user?.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Mail className="w-3.5 h-3.5" />
                    {doctor.user.email}
                  </div>
                )}
                {doctor.user?.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Phone className="w-3.5 h-3.5" />
                    {doctor.user.phone}
                  </div>
                )}
                {doctor.departments?.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Building2 className="w-3.5 h-3.5" />
                    {doctor.departments.map((d) => d.department.name).join(', ')}
                  </div>
                )}
                {doctor.consultationFee && (
                  <p className="text-sm font-medium text-emerald-600">
                    ${doctor.consultationFee} / visit
                  </p>
                )}
              </div>

              {isAdmin && (
                <div className="mt-4 pt-3 border-t border-gray-100 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleEdit(doctor);
                    }}
                    className="btn-sm btn-secondary"
                  >
                    <Edit2 className="w-3 h-3" />
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleDelete(doctor.id);
                    }}
                    className="btn-sm btn-danger"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editing ? 'Edit Doctor' : 'Add Doctor'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editing && (
                <>
                  <div>
                    <label className="label">Doctor Name *</label>
                    <input type="text" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required={!editing} />
                  </div>
                  <div>
                    <label className="label">Email *</label>
                    <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required={!editing} />
                  </div>
                  <div>
                    <label className="label">Password *</label>
                    <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editing} placeholder="Min 6 characters" />
                  </div>
                </>
              )}
              <div>
                <label className="label">Specialization</label>
                <input
                  type="text"
                  className="input"
                  value={form.specialization}
                  onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">License Number</label>
                <input
                  type="text"
                  className="input"
                  value={form.licenseNumber}
                  onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Bio</label>
                <textarea
                  className="input"
                  rows={3}
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Consultation Fee ($)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={form.consultationFee}
                  onChange={(e) => setForm({ ...form, consultationFee: e.target.value })}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">
                  {editing ? 'Update' : 'Create'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
