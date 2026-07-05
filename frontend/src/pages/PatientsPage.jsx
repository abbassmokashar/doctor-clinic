import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { patientAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import MultiTabForm from '../components/MultiTabForm';
import ConfirmModal from '../components/ConfirmModal';
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
} from 'lucide-react';
import toast from 'react-hot-toast';

const bloodTypes = ['A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE'];
const genders = ['MALE', 'FEMALE', 'PREFER_NOT_TO_SAY'];

const INITIAL_FORM = {
  firstName: '', lastName: '', dateOfBirth: '', gender: '', phone: '', email: '',
  address: '', bloodType: '', allergies: '', emergencyContact: '', emergencyPhone: '', notes: '',
};

export default function PatientsPage() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingCloseId, setPendingCloseId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const { isAdmin, isDoctor, isReceptionist } = useAuth();
  const canEdit = isAdmin || isDoctor || isReceptionist;
  const tabIdCounter = useRef(0);

  // Persist tabs to localStorage
  const PATIENT_TABS_KEY = 'patientTabs';
  const PATIENT_ACTIVE_KEY = 'patientActiveTabId';

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PATIENT_TABS_KEY);
      const savedActive = localStorage.getItem(PATIENT_ACTIVE_KEY);
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
        localStorage.setItem(PATIENT_TABS_KEY, JSON.stringify(tabs));
        localStorage.setItem(PATIENT_ACTIVE_KEY, JSON.stringify(activeTabId));
      } catch {
        // localStorage might be full
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [tabs, activeTabId]);

  useEffect(() => {
    const save = () => {
      try {
        localStorage.setItem(PATIENT_TABS_KEY, JSON.stringify(tabs));
        localStorage.setItem(PATIENT_ACTIVE_KEY, JSON.stringify(activeTabId));
      } catch {}
    };
    window.addEventListener('beforeunload', save);
    return () => window.removeEventListener('beforeunload', save);
  }, [tabs, activeTabId]);

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

  const openTab = useCallback((editingPatient = null) => {
    const id = ++tabIdCounter.current;
    const form = editingPatient
      ? {
          firstName: editingPatient.firstName || '',
          lastName: editingPatient.lastName || '',
          dateOfBirth: editingPatient.dateOfBirth ? editingPatient.dateOfBirth.split('T')[0] : '',
          gender: editingPatient.gender || '',
          phone: editingPatient.phone || '',
          email: editingPatient.email || '',
          address: editingPatient.address || '',
          bloodType: editingPatient.bloodType || '',
          allergies: editingPatient.allergies || '',
          emergencyContact: editingPatient.emergencyContact || '',
          emergencyPhone: editingPatient.emergencyPhone || '',
          notes: editingPatient.notes || '',
        }
      : { ...INITIAL_FORM };
    const newTab = {
      id,
      title: editingPatient ? `Edit: ${editingPatient.firstName} ${editingPatient.lastName}` : 'New Patient',
      form,
      initialForm: { ...form },
      type: editingPatient ? 'update' : 'create',
      recordId: editingPatient?.id || null,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(id);
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

  const handleSubmitTab = async (tab) => {
    setSubmitting(true);
    try {
      if (tab.type === 'update' && tab.recordId) {
        await patientAPI.update(tab.recordId, tab.form);
        toast.success('Patient updated successfully');
      } else {
        await patientAPI.create(tab.form);
        toast.success('Patient created successfully');
      }
      closeTab(tab.id, true);
      fetchPatients();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await patientAPI.delete(id);
      toast.success('Patient deleted');
      fetchPatients();
    } catch (error) {
      toast.error('Failed to delete patient');
    }
  };

  const renderPatientForm = (tab, onFieldChange) => (
    <div className="max-w-lg grid grid-cols-2 gap-4">
      <div className="col-span-2 sm:col-span-1">
        <label className="label">First Name *</label>
        <input type="text" className="input" value={tab.form.firstName} onChange={(e) => onFieldChange({ ...tab.form, firstName: e.target.value })} required />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label className="label">Last Name *</label>
        <input type="text" className="input" value={tab.form.lastName} onChange={(e) => onFieldChange({ ...tab.form, lastName: e.target.value })} required />
      </div>
      <div>
        <label className="label">Date of Birth</label>
        <input type="date" className="input" value={tab.form.dateOfBirth} onChange={(e) => onFieldChange({ ...tab.form, dateOfBirth: e.target.value })} />
      </div>
      <div>
        <label className="label">Gender</label>
        <select className="input" value={tab.form.gender} onChange={(e) => onFieldChange({ ...tab.form, gender: e.target.value })}>
          <option value="">Select...</option>
          {genders.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Phone *</label>
        <input type="text" className="input" value={tab.form.phone} onChange={(e) => onFieldChange({ ...tab.form, phone: e.target.value })} required />
      </div>
      <div>
        <label className="label">Email</label>
        <input type="email" className="input" value={tab.form.email} onChange={(e) => onFieldChange({ ...tab.form, email: e.target.value })} />
      </div>
      <div className="col-span-2">
        <label className="label">Address</label>
        <input type="text" className="input" value={tab.form.address} onChange={(e) => onFieldChange({ ...tab.form, address: e.target.value })} />
      </div>
      <div>
        <label className="label">Blood Type</label>
        <select className="input" value={tab.form.bloodType} onChange={(e) => onFieldChange({ ...tab.form, bloodType: e.target.value })}>
          <option value="">Select...</option>
          {bloodTypes.map((b) => <option key={b} value={b}>{b.replace('_', ' ')}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Allergies</label>
        <input type="text" className="input" value={tab.form.allergies} onChange={(e) => onFieldChange({ ...tab.form, allergies: e.target.value })} />
      </div>
      <div>
        <label className="label">Emergency Contact</label>
        <input type="text" className="input" value={tab.form.emergencyContact} onChange={(e) => onFieldChange({ ...tab.form, emergencyContact: e.target.value })} />
      </div>
      <div>
        <label className="label">Emergency Phone</label>
        <input type="text" className="input" value={tab.form.emergencyPhone} onChange={(e) => onFieldChange({ ...tab.form, emergencyPhone: e.target.value })} />
      </div>
      <div className="col-span-2">
        <label className="label">Notes</label>
        <textarea className="input" rows={2} value={tab.form.notes} onChange={(e) => onFieldChange({ ...tab.form, notes: e.target.value })} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
          <p className="text-gray-500 mt-1">Manage patient records and medical history</p>
        </div>
        {canEdit && (
          <button onClick={() => openTab()} className="btn-primary">
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
                  <button onClick={(e) => { e.preventDefault(); openTab(patient); }} className="btn-sm btn-secondary">
                    <Edit2 className="w-3 h-3" /> Edit
                  </button>
                  <button onClick={(e) => { e.preventDefault(); setConfirmDeleteId(patient.id); }} className="btn-sm btn-danger">
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              )}
            </Link>
          ))}
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
        renderForm={renderPatientForm}
        onSubmit={handleSubmitTab}
        submitLabel={tabs.find((t) => t.id === activeTabId)?.type === 'update' ? 'Update Patient' : 'Create Patient'}
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

      {/* Delete Patient Confirm Modal */}
      <ConfirmModal
        open={confirmDeleteId !== null}
        title="Delete Patient"
        message="Are you sure you want to delete this patient? This action cannot be undone. All associated data will be permanently removed."
        confirmLabel="Delete Patient"
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
