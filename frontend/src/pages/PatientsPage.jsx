import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { patientAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  Heart,
  Loader2,
  Edit2,
  Trash2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

const bloodTypes = ['A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE'];
const genders = ['MALE', 'FEMALE', 'PREFER_NOT_TO_SAY'];

export default function PatientsPage() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    firstName: '', lastName: '', dateOfBirth: '', gender: '', phone: '', email: '',
    address: '', bloodType: '', allergies: '', emergencyContact: '', emergencyPhone: '', notes: '',
  });
  const { isAdmin, isDoctor, isReceptionist } = useAuth();
  const canEdit = isAdmin || isDoctor || isReceptionist;

  const fetchPatients = () => {
    setLoading(true);
    patientAPI
      .getAll({ search })
      .then((res) => setPatients(res.data))
      .catch(() => toast.error('Failed to load patients'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(fetchPatients, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await patientAPI.update(editing.id, form);
        toast.success('Patient updated successfully');
      } else {
        await patientAPI.create(form);
        toast.success('Patient created successfully');
      }
      setShowModal(false);
      setEditing(null);
      setForm({ firstName: '', lastName: '', dateOfBirth: '', gender: '', phone: '', email: '', address: '', bloodType: '', allergies: '', emergencyContact: '', emergencyPhone: '', notes: '' });
      fetchPatients();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Operation failed');
    }
  };

  const handleEdit = (patient) => {
    setEditing(patient);
    setForm({
      firstName: patient.firstName || '',
      lastName: patient.lastName || '',
      dateOfBirth: patient.dateOfBirth ? patient.dateOfBirth.split('T')[0] : '',
      gender: patient.gender || '',
      phone: patient.phone || '',
      email: patient.email || '',
      address: patient.address || '',
      bloodType: patient.bloodType || '',
      allergies: patient.allergies || '',
      emergencyContact: patient.emergencyContact || '',
      emergencyPhone: patient.emergencyPhone || '',
      notes: patient.notes || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure?')) return;
    try {
      await patientAPI.delete(id);
      toast.success('Patient deleted');
      fetchPatients();
    } catch (error) {
      toast.error('Failed to delete patient');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
          <p className="text-gray-500 mt-1">Manage patient records and medical history</p>
        </div>
        {canEdit && (
          <button
            onClick={() => {
              setEditing(null);
              setForm({ firstName: '', lastName: '', dateOfBirth: '', gender: '', phone: '', email: '', address: '', bloodType: '', allergies: '', emergencyContact: '', emergencyPhone: '', notes: '' });
              setShowModal(true);
            }}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            Add Patient
          </button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search patients by name, phone, or email..."
          className="input pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : patients.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No patients found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {patients.map((patient) => (
            <Link
              key={patient.id}
              to={`/patients/${patient.id}`}
              className="card p-5 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 text-lg font-semibold">
                    {patient.firstName?.charAt(0)}{patient.lastName?.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                      {patient.firstName} {patient.lastName}
                    </h3>
                    <p className="text-sm text-gray-500">{patient.phone}</p>
                  </div>
                </div>
                {patient.bloodType && (
                  <span className="badge bg-red-50 text-red-700">{patient.bloodType.replace('_', ' ')}</span>
                )}
              </div>

              <div className="mt-4 space-y-1.5 text-sm text-gray-500">
                {patient.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5" /> {patient.email}
                  </div>
                )}
                {patient.allergies && (
                  <div className="flex items-center gap-2 text-amber-600">
                    <Heart className="w-3.5 h-3.5" /> Allergies: {patient.allergies}
                  </div>
                )}
              </div>

              <div className="mt-3 flex gap-3 text-xs text-gray-400">
                <span>{patient._count?.appointments || 0} appointments</span>
                <span>{patient._count?.medicalRecords || 0} records</span>
              </div>

              {canEdit && (
                <div className="mt-4 pt-3 border-t border-gray-100 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.preventDefault(); handleEdit(patient); }} className="btn-sm btn-secondary">
                    <Edit2 className="w-3 h-3" /> Edit
                  </button>
                  <button onClick={(e) => { e.preventDefault(); handleDelete(patient.id); }} className="btn-sm btn-danger">
                    <Trash2 className="w-3 h-3" /> Delete
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
          <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editing ? 'Edit Patient' : 'Add Patient'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="label">First Name *</label>
                <input type="text" className="input" value={form.firstName} onChange={(e) => setForm({...form, firstName: e.target.value})} required />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="label">Last Name *</label>
                <input type="text" className="input" value={form.lastName} onChange={(e) => setForm({...form, lastName: e.target.value})} required />
              </div>
              <div>
                <label className="label">Date of Birth</label>
                <input type="date" className="input" value={form.dateOfBirth} onChange={(e) => setForm({...form, dateOfBirth: e.target.value})} />
              </div>
              <div>
                <label className="label">Gender</label>
                <select className="input" value={form.gender} onChange={(e) => setForm({...form, gender: e.target.value})}>
                  <option value="">Select...</option>
                  {genders.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Phone *</label>
                <input type="text" className="input" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} required />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} />
              </div>
              <div className="col-span-2">
                <label className="label">Address</label>
                <input type="text" className="input" value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} />
              </div>
              <div>
                <label className="label">Blood Type</label>
                <select className="input" value={form.bloodType} onChange={(e) => setForm({...form, bloodType: e.target.value})}>
                  <option value="">Select...</option>
                  {bloodTypes.map((b) => <option key={b} value={b}>{b.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Allergies</label>
                <input type="text" className="input" value={form.allergies} onChange={(e) => setForm({...form, allergies: e.target.value})} />
              </div>
              <div>
                <label className="label">Emergency Contact</label>
                <input type="text" className="input" value={form.emergencyContact} onChange={(e) => setForm({...form, emergencyContact: e.target.value})} />
              </div>
              <div>
                <label className="label">Emergency Phone</label>
                <input type="text" className="input" value={form.emergencyPhone} onChange={(e) => setForm({...form, emergencyPhone: e.target.value})} />
              </div>
              <div className="col-span-2">
                <label className="label">Notes</label>
                <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} />
              </div>
              <div className="col-span-2 flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">{editing ? 'Update' : 'Create'}</button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
