import { useState, useEffect } from 'react';
import { medicationAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import ConfirmModal from '../components/ConfirmModal';
import {
  Pill,
  Plus,
  Search,
  Loader2,
  Edit2,
  Trash2,
  X,
  FlaskConical,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';

const dosageForms = ['Tablet', 'Capsule', 'Liquid', 'Injection', 'Cream', 'Inhaler', 'Drops', 'Patch'];

export default function MedicationsPage() {
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', manufacturer: '', dosageForm: '', sideEffects: '' });
  const { isAdmin, isDoctor } = useAuth();
  const canEdit = isAdmin || isDoctor;

  const fetchMedications = () => {
    setLoading(true);
    medicationAPI
      .getAll({ search })
      .then((res) => setMedications(res.data))
      .catch(() => toast.error('Failed to load medications'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(fetchMedications, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await medicationAPI.update(editing.id, form);
        toast.success('Medication updated');
      } else {
        await medicationAPI.create(form);
        toast.success('Medication created');
      }
      setShowModal(false);
      setEditing(null);
      setForm({ name: '', description: '', manufacturer: '', dosageForm: '', sideEffects: '' });
      fetchMedications();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Operation failed');
    }
  };

  const handleEdit = (med) => {
    setEditing(med);
    setForm({
      name: med.name,
      description: med.description || '',
      manufacturer: med.manufacturer || '',
      dosageForm: med.dosageForm || '',
      sideEffects: med.sideEffects || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    try {
      await medicationAPI.delete(id);
      toast.success('Medication deleted');
      fetchMedications();
    } catch (error) {
      toast.error('Failed to delete medication');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Medications</h1>
          <p className="text-gray-500 mt-1">Manage medication inventory and information</p>
        </div>
        {canEdit && (
          <button onClick={() => { setEditing(null); setForm({ name: '', description: '', manufacturer: '', dosageForm: '', sideEffects: '' }); setShowModal(true); }} className="btn-primary">
            <Plus className="w-4 h-4" />
            Add Medication
          </button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Search medications..." className="input pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : medications.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Pill className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No medications found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {medications.map((med) => (
            <div key={med.id} className="card p-5 group">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-50 text-purple-600">
                    <Pill className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{med.name}</h3>
                    {med.dosageForm && (
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <FlaskConical className="w-3 h-3" /> {med.dosageForm}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {med.description && (
                <p className="text-sm text-gray-600 mt-3">{med.description}</p>
              )}
              {med.manufacturer && (
                <p className="text-xs text-gray-400 mt-2">{med.manufacturer}</p>
              )}
              {med.sideEffects && (
                <div className="mt-2 flex items-start gap-1 text-xs text-amber-600">
                  <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>{med.sideEffects}</span>
                </div>
              )}

              {canEdit && (
                <div className="mt-4 pt-3 border-t border-gray-100 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(med)} className="btn-sm btn-secondary">
                    <Edit2 className="w-3 h-3" /> Edit
                  </button>
                  <button onClick={() => setConfirmDeleteId(med.id)} className="btn-sm btn-danger">
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{editing ? 'Edit Medication' : 'Add Medication'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Name *</label>
                <input type="text" className="input" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} />
              </div>
              <div>
                <label className="label">Manufacturer</label>
                <input type="text" className="input" value={form.manufacturer} onChange={(e) => setForm({...form, manufacturer: e.target.value})} />
              </div>
              <div>
                <label className="label">Dosage Form</label>
                <select className="input" value={form.dosageForm} onChange={(e) => setForm({...form, dosageForm: e.target.value})}>
                  <option value="">Select...</option>
                  {dosageForms.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Side Effects</label>
                <textarea className="input" rows={2} value={form.sideEffects} onChange={(e) => setForm({...form, sideEffects: e.target.value})} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">{editing ? 'Update' : 'Create'}</button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      <ConfirmModal
        open={confirmDeleteId !== null}
        title="Delete Medication"
        message="Are you sure you want to delete this medication? All associated data will be permanently removed."
        confirmLabel="Delete Medication"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          const id = confirmDeleteId;
          setConfirmDeleteId(null);
          handleDelete(id);
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
