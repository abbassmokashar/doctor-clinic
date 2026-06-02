import { useState, useEffect } from 'react';
import { medicalRecordAPI, patientAPI, doctorAPI, prescriptionAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  FileText,
  Search,
  Plus,
  Loader2,
  X,
  Stethoscope,
  Pill,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function MedicalRecordsPage() {
  const [records, setRecords] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    patientId: '', doctorId: '', appointmentId: '', diagnosis: '', symptoms: '', notes: '',
  });
  const [prescriptions, setPrescriptions] = useState([]);
  const [prescriptionForm, setPrescriptionForm] = useState({
    medicationName: '', dosage: '', frequency: '', duration: '', instructions: '',
  });
  const { isAdmin, isDoctor, user } = useAuth();
  const canCreate = isAdmin || isDoctor;

  const fetchRecords = () => {
    if (!selectedPatient) {
      setRecords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    medicalRecordAPI
      .getByPatient(selectedPatient)
      .then((res) => setRecords(res.data))
      .catch(() => toast.error('Failed to load records'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    Promise.all([
      patientAPI.getAll({}),
      doctorAPI.getAll(),
    ])
      .then(([patRes, docRes]) => {
        setPatients(patRes.data);
        setDoctors(docRes.data);
        // For doctors, auto-set their doctor ID
        if (isDoctor) {
          const myDoctor = docRes.data.find(d => d.userId === user?.id);
          if (myDoctor) {
            setForm(prev => ({ ...prev, doctorId: myDoctor.id.toString() }));
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => { fetchRecords(); }, [selectedPatient]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await medicalRecordAPI.create(form);
      // Create prescriptions for this record
      if (prescriptions.length > 0) {
        for (const p of prescriptions) {
          await prescriptionAPI.create({
            medicalRecordId: res.data.id,
            medicationName: p.medicationName,
            dosage: p.dosage,
            frequency: p.frequency,
            duration: p.duration,
            instructions: p.instructions,
          }).catch(() => {});
        }
      }
      toast.success('Medical record created');
      setShowModal(false);
      setForm({ patientId: '', doctorId: '', appointmentId: '', diagnosis: '', symptoms: '', notes: '' });
      setPrescriptions([]);
      if (selectedPatient) fetchRecords();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create record');
    }
  };

  const addPrescription = () => {
    if (!prescriptionForm.medicationName || !prescriptionForm.dosage) {
      toast.error('Medication name and dosage required');
      return;
    }
    setPrescriptions([...prescriptions, { ...prescriptionForm }]);
    setPrescriptionForm({ medicationName: '', dosage: '', frequency: '', duration: '', instructions: '' });
  };

  const removePrescription = (index) => {
    setPrescriptions(prescriptions.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Medical Records</h1>
          <p className="text-gray-500 mt-1">View and manage patient medical records</p>
        </div>
        {canCreate && selectedPatient && (
          <button
            onClick={() => {
              setForm({ ...form, patientId: selectedPatient });
              setShowModal(true);
            }}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            New Record
          </button>
        )}
      </div>

      {/* Patient selector */}
      <div className="max-w-md">
        <label className="label">Select Patient</label>
        <select
          className="input"
          value={selectedPatient}
          onChange={(e) => setSelectedPatient(e.target.value)}
        >
          <option value="">Choose a patient...</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.firstName} {p.lastName} - {p.phone}
            </option>
          ))}
        </select>
      </div>

      {!selectedPatient ? (
        <div className="text-center py-12 text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Select a patient to view their medical records</p>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : records.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No medical records for this patient</p>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map((record) => (
            <div key={record.id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{record.diagnosis}</h3>
                  <p className="text-xs text-gray-500">
                    Dr. {record.doctor?.user?.name} - {new Date(record.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {record.appointment && (
                  <span className="text-xs text-gray-400">
                    Appointment: {new Date(record.appointment.dateTime).toLocaleDateString()}
                  </span>
                )}
              </div>
              {record.symptoms && (
                <div className="mb-2">
                  <span className="text-xs font-medium text-gray-500">Symptoms:</span>
                  <p className="text-sm text-gray-700">{record.symptoms}</p>
                </div>
              )}
              {record.notes && (
                <div className="mb-3">
                  <span className="text-xs font-medium text-gray-500">Notes:</span>
                  <p className="text-sm text-gray-600">{record.notes}</p>
                </div>
              )}
              {record.prescriptions?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                    <Pill className="w-3 h-3" /> Prescriptions
                  </p>
                  <div className="space-y-1">
                    {record.prescriptions.map((p) => (
                      <div key={p.id} className="text-sm text-gray-700 bg-gray-50 rounded px-3 py-1.5">
                        <span className="font-medium">{p.medicationName}</span> - {p.dosage}, {p.frequency}
                        {p.duration && ` for ${p.duration}`}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Record Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">New Medical Record</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Doctor *</label>
                {isDoctor ? (
                  <div className="input bg-gray-50 text-gray-700">
                    {doctors.find(d => d.id.toString() === form.doctorId)?.user?.name || 'You'}
                  </div>
                ) : (
                  <select className="input" value={form.doctorId} onChange={(e) => setForm({...form, doctorId: e.target.value})} required>
                    <option value="">Select doctor...</option>
                    {doctors.map((d) => <option key={d.id} value={d.id}>{d.user?.name}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="label">Diagnosis *</label>
                <input type="text" className="input" value={form.diagnosis} onChange={(e) => setForm({...form, diagnosis: e.target.value})} required />
              </div>
              <div>
                <label className="label">Symptoms</label>
                <textarea className="input" rows={2} value={form.symptoms} onChange={(e) => setForm({...form, symptoms: e.target.value})} />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input" rows={3} value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} />
              </div>

              {/* Prescriptions */}
              <div className="pt-3 border-t border-gray-100">
                <p className="label flex items-center gap-1">
                  <Pill className="w-4 h-4" /> Prescriptions
                </p>
                {prescriptions.map((p, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2 mb-2 text-sm">
                    <span><strong>{p.medicationName}</strong> - {p.dosage}, {p.frequency}</span>
                    <button type="button" onClick={() => removePrescription(i)} className="text-red-500 hover:text-red-700">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" placeholder="Medication name" className="input text-sm" value={prescriptionForm.medicationName}
                    onChange={(e) => setPrescriptionForm({...prescriptionForm, medicationName: e.target.value})} />
                  <input type="text" placeholder="Dosage (e.g. 500mg)" className="input text-sm" value={prescriptionForm.dosage}
                    onChange={(e) => setPrescriptionForm({...prescriptionForm, dosage: e.target.value})} />
                  <input type="text" placeholder="Frequency (e.g. 3x/day)" className="input text-sm" value={prescriptionForm.frequency}
                    onChange={(e) => setPrescriptionForm({...prescriptionForm, frequency: e.target.value})} />
                  <input type="text" placeholder="Duration (e.g. 7 days)" className="input text-sm" value={prescriptionForm.duration}
                    onChange={(e) => setPrescriptionForm({...prescriptionForm, duration: e.target.value})} />
                </div>
                <button type="button" onClick={addPrescription} className="btn-sm btn-secondary mt-2">
                  <Plus className="w-3 h-3" /> Add Prescription
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">Create Record</button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
