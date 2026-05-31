import { useState, useEffect } from 'react';
import { departmentAPI, doctorAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  Building2,
  Plus,
  Loader2,
  Edit2,
  Trash2,
  X,
  Stethoscope,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [showAddDoctor, setShowAddDoctor] = useState(null);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const { isAdmin } = useAuth();

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      departmentAPI.getAll(),
      doctorAPI.getAll(),
    ])
      .then(([deptRes, docRes]) => {
        setDepartments(deptRes.data);
        setDoctors(docRes.data);
      })
      .catch(() => toast.error('Failed to load data'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await departmentAPI.update(editing.id, form);
        toast.success('Department updated');
      } else {
        await departmentAPI.create(form);
        toast.success('Department created');
      }
      setShowModal(false);
      setEditing(null);
      setForm({ name: '', description: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this department?')) return;
    try {
      await departmentAPI.delete(id);
      toast.success('Department deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete department');
    }
  };

  const handleAddDoctor = async (departmentId) => {
    if (!selectedDoctor) return;
    try {
      await departmentAPI.addDoctor(departmentId, { doctorId: parseInt(selectedDoctor) });
      toast.success('Doctor added to department');
      setShowAddDoctor(null);
      setSelectedDoctor('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add doctor');
    }
  };

  const handleRemoveDoctor = async (departmentId, doctorId) => {
    try {
      await departmentAPI.removeDoctor(departmentId, doctorId);
      toast.success('Doctor removed from department');
      fetchData();
    } catch (error) {
      toast.error('Failed to remove doctor');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
          <p className="text-gray-500 mt-1">Manage clinic departments and doctor assignments</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setEditing(null); setForm({ name: '', description: '' }); setShowModal(true); }} className="btn-primary">
            <Plus className="w-4 h-4" />
            Add Department
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : departments.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No departments created yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {departments.map((dept) => (
            <div key={dept.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{dept.name}</h3>
                    <p className="text-xs text-gray-500">{dept._count?.doctors || 0} doctors</p>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-1">
                    <button onClick={() => { setEditing(dept); setForm({ name: dept.name, description: dept.description || '' }); setShowModal(true); }} className="btn-sm btn-secondary">
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button onClick={() => handleDelete(dept.id)} className="btn-sm btn-danger">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {dept.description && (
                <p className="text-sm text-gray-600 mt-3">{dept.description}</p>
              )}

              {/* Doctors in department */}
              {dept.doctors?.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                    <Stethoscope className="w-3 h-3" /> Assigned Doctors
                  </p>
                  <div className="space-y-1">
                    {dept.doctors.map((dd) => (
                      <div key={dd.doctor.id} className="flex items-center justify-between text-sm py-1">
                        <span className="text-gray-700">{dd.doctor.user?.name}</span>
                        {isAdmin && (
                          <button onClick={() => handleRemoveDoctor(dept.id, dd.doctor.id)} className="text-red-500 hover:text-red-700 text-xs">
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isAdmin && (
                <div className="mt-3">
                  {showAddDoctor === dept.id ? (
                    <div className="flex gap-2">
                      <select className="input text-sm py-1.5" value={selectedDoctor} onChange={(e) => setSelectedDoctor(e.target.value)}>
                        <option value="">Select doctor...</option>
                        {doctors.filter((d) => !dept.doctors?.some((dd) => dd.doctor.id === d.id)).map((d) => (
                          <option key={d.id} value={d.id}>{d.user?.name}</option>
                        ))}
                      </select>
                      <button onClick={() => handleAddDoctor(dept.id)} className="btn-sm btn-primary">Add</button>
                      <button onClick={() => setShowAddDoctor(null)} className="btn-sm btn-secondary">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setShowAddDoctor(dept.id)} className="btn-sm btn-secondary text-xs">
                      <Plus className="w-3 h-3" /> Assign Doctor
                    </button>
                  )}
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
              <h2 className="text-lg font-semibold">{editing ? 'Edit Department' : 'Add Department'}</h2>
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
                <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} />
              </div>
              <div className="flex gap-3 pt-2">
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
