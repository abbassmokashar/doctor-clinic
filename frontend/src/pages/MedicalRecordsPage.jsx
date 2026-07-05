import { useState, useEffect, useRef, useCallback } from 'react';
import { medicalRecordAPI, patientAPI, doctorAPI, prescriptionAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  FileText,
  Plus,
  Loader2,
  X,
  Stethoscope,
  Pill,
  Image,
  Upload,
  ChevronLeft,
  ChevronRight,
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
  const { isAdmin, isDoctor, isReceptionist } = useAuth();
  const canCreate = isAdmin || isDoctor || isReceptionist;

  // Image upload state
  const [uploadingRecordId, setUploadingRecordId] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deletingImageIdx, setDeletingImageIdx] = useState(null);
  const imageInputRefs = useRef({});

  // Pending images for the create modal (selected but not yet uploaded)
  const [pendingImages, setPendingImages] = useState([]);
  const modalFileInputRef = useRef(null);

  // Lightbox state
  const [lightboxImages, setLightboxImages] = useState(null);
  const [lightboxIdx, setLightboxIdx] = useState(0);

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
        if (isDoctor && docRes.data.length > 0) {
          setForm(prev => ({ ...prev, doctorId: docRes.data[0].id.toString() }));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => { fetchRecords(); }, [selectedPatient]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Create the record first
      const res = await medicalRecordAPI.create(form);
      const recordId = res.data.id;

      // Upload pending images to the created record
      let uploadErrors = 0;
      if (pendingImages.length > 0) {
        for (const file of pendingImages) {
          try {
            const formData = new FormData();
            formData.append('image', file);
            await medicalRecordAPI.uploadImage(recordId, formData);
          } catch (err) {
            uploadErrors++;
            console.error('Failed to upload image:', err);
          }
        }
      }

      // Create prescriptions for this record
      if (prescriptions.length > 0) {
        let hasError = false;
        for (const p of prescriptions) {
          try {
            await prescriptionAPI.create({
              medicalRecordId: recordId,
              medicationName: p.medicationName,
              dosage: p.dosage,
              frequency: p.frequency,
              duration: p.duration,
              instructions: p.instructions,
            });
          } catch (err) {
            hasError = true;
            console.error('Failed to create prescription:', err);
          }
        }
        if (hasError) {
          toast.error('Some prescriptions could not be saved');
        }
      }

      if (uploadErrors > 0) {
        toast.error(`${uploadErrors} image(s) could not be uploaded`);
      } else if (pendingImages.length > 0) {
        toast.success(`${pendingImages.length} image(s) uploaded`);
      }

      toast.success('Medical record created');
      revokePendingImageUrls();
      setShowModal(false);
      setForm({ patientId: '', doctorId: '', appointmentId: '', diagnosis: '', symptoms: '', notes: '' });
      setPrescriptions([]);
      setPendingImages([]);
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

  // Revoke all pending image object URLs to prevent memory leaks
  const revokePendingImageUrls = useCallback(() => {
    pendingImages.forEach((file) => {
      if (file._previewUrl) {
        URL.revokeObjectURL(file._previewUrl);
      }
    });
  }, [pendingImages]);

  const handleCloseModal = useCallback(() => {
    revokePendingImageUrls();
    setPendingImages([]);
    setShowModal(false);
  }, [revokePendingImageUrls]);

  const removePrescription = (index) => {
    setPrescriptions(prescriptions.filter((_, i) => i !== index));
  };

  const handleSelectImages = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    // Create preview URLs stored on the file object for later cleanup
    const withPreviews = files.map((f) => {
      f._previewUrl = URL.createObjectURL(f);
      return f;
    });
    setPendingImages((prev) => [...prev, ...withPreviews]);
    e.target.value = '';
  };

  const removePendingImage = (index) => {
    setPendingImages((prev) => {
      const removed = prev[index];
      if (removed?._previewUrl) URL.revokeObjectURL(removed._previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleUploadImage = async (recordId, file) => {
    if (!file) return;
    setUploadingImage(true);
    setUploadingRecordId(recordId);
    try {
      const formData = new FormData();
      formData.append('image', file);
      await medicalRecordAPI.uploadImage(recordId, formData);
      toast.success('Image uploaded');
      // Refresh the records to show the new image
      fetchRecords();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
      setUploadingRecordId(null);
    }
  };

  const handleRemoveImage = async (recordId, imageIndex) => {
    setDeletingImageIdx(imageIndex);
    try {
      await medicalRecordAPI.removeImage(recordId, imageIndex);
      toast.success('Image removed');
      fetchRecords();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to remove image');
    } finally {
      setDeletingImageIdx(null);
    }
  };

  const parseImages = (record) => {
    if (!record.images) return [];
    try {
      const parsed = JSON.parse(record.images);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
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
          {records.map((record) => {
            const recordImages = parseImages(record);
            return (
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

                {/* Images */}
                {recordImages.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                      <Image className="w-3 h-3" /> Images ({recordImages.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {recordImages.map((img, idx) => (
                        <div key={idx} className="relative group">
                          <button
                            type="button"
                            onClick={() => {
                              setLightboxImages(recordImages);
                              setLightboxIdx(idx);
                            }}
                            className="block w-20 h-20 rounded-lg overflow-hidden border border-gray-200 hover:border-primary-400 transition-colors"
                          >
                            <img
                              src={img.url}
                              alt={img.originalName || `Image ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </button>
                          {canCreate && (
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(record.id, idx)}
                              disabled={deletingImageIdx === idx}
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                            >
                              {deletingImageIdx === idx ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <X className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Image upload button */}
                {canCreate && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <input
                      ref={(el) => (imageInputRefs.current[record.id] = el)}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) handleUploadImage(record.id, file);
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => imageInputRefs.current[record.id]?.click()}
                      disabled={uploadingImage && uploadingRecordId === record.id}
                      className="btn-sm btn-secondary text-xs"
                    >
                      {uploadingImage && uploadingRecordId === record.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Upload className="w-3 h-3" />
                      )}
                      {uploadingImage && uploadingRecordId === record.id ? 'Uploading...' : recordImages.length > 0 ? 'Add Image' : 'Upload Image'}
                    </button>
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
            );
          })}
        </div>
      )}

      {/* Create Record Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={handleCloseModal} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">New Medical Record</h2>
              <button onClick={handleCloseModal} className="p-1 hover:bg-gray-100 rounded">
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

              {/* Images */}
              <div className="pt-3 border-t border-gray-100">
                <p className="label flex items-center gap-1">
                  <Image className="w-4 h-4" /> Images
                </p>
                <p className="text-xs text-gray-500 mb-3">
                  Attach images (X-rays, scans, photos) to this medical record.
                </p>

                {/* Selected image previews */}
                {pendingImages.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {pendingImages.map((file, idx) => (
                      <div key={idx} className="relative group">
                        <div className="w-20 h-20 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                          <img
                            src={file._previewUrl}
                            alt={file.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removePendingImage(idx)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <input
                  ref={modalFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  multiple
                  className="hidden"
                  onChange={handleSelectImages}
                />
                <button
                  type="button"
                  onClick={() => modalFileInputRef.current?.click()}
                  className="btn-sm btn-secondary text-xs"
                >
                  <Upload className="w-3 h-3" />
                  {pendingImages.length > 0 ? 'Add More Images' : 'Select Images'}
                </button>
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
                <button type="button" onClick={handleCloseModal} className="btn-secondary flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxImages && lightboxImages.length > 0 && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxImages(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxImages(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {lightboxImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIdx((prev) => (prev - 1 + lightboxImages.length) % lightboxImages.length);
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors z-10"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIdx((prev) => (prev + 1) % lightboxImages.length);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors z-10"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          <div
            className="max-w-[90vw] max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxImages[lightboxIdx]?.url}
              alt={lightboxImages[lightboxIdx]?.originalName || `Image ${lightboxIdx + 1}`}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
            <div className="mt-3 flex items-center gap-3 text-white/70 text-sm">
              <span>
                {lightboxIdx + 1} / {lightboxImages.length}
              </span>
              {lightboxImages[lightboxIdx]?.originalName && (
                <span className="text-white/50">{lightboxImages[lightboxIdx].originalName}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
