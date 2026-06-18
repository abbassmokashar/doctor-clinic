import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { patientAPI, medicalTestAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  ArrowLeft,
  Phone,
  Mail,
  Calendar,
  MapPin,
  AlertTriangle,
  PhoneCall,
  FileText,
  Pill,
  DollarSign,
  Loader2,
  Upload,
  Download,
  Trash2,
  FileUp,
  X,
  File as FileIcon,
  Image,
  ExternalLink,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function PatientDetailPage() {
  const { id } = useParams();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [medicalTests, setMedicalTests] = useState([]);
  const [testsLoading, setTestsLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({ testType: '', notes: '', file: null });
  const [uploading, setUploading] = useState(false);
  const [previewTest, setPreviewTest] = useState(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const { isAdmin, isDoctor } = useAuth();
  const canUpload = isAdmin || isDoctor;

  const fetchMedicalTests = () => {
    setTestsLoading(true);
    medicalTestAPI
      .getByPatient(id)
      .then((res) => setMedicalTests(res.data))
      .catch(() => {})
      .finally(() => setTestsLoading(false));
  };

  // Close preview on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setPreviewTest(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    patientAPI
      .getById(id)
      .then((res) => setPatient(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
    fetchMedicalTests();
  }, [id]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadForm.file) {
      toast.error('Please select a file to upload');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadForm.file);
      formData.append('patientId', id);
      if (uploadForm.testType) formData.append('testType', uploadForm.testType);
      if (uploadForm.notes) formData.append('notes', uploadForm.notes);

      await medicalTestAPI.upload(formData);
      toast.success('Test file uploaded successfully');
      setShowUploadModal(false);
      setUploadForm({ testType: '', notes: '', file: null });
      fetchMedicalTests();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteTest = async (testId) => {
    if (!confirm('Are you sure you want to delete this test file?')) return;
    try {
      await medicalTestAPI.delete(testId);
      toast.success('Test file deleted');
      fetchMedicalTests();
    } catch (error) {
      toast.error('Failed to delete test file');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (fileType) => {
    if (fileType?.startsWith('image/')) return <Image className="w-4 h-4" />;
    if (fileType?.includes('pdf')) return <FileIcon className="w-4 h-4" />;
    if (fileType?.includes('word')) return <FileIcon className="w-4 h-4" />;
    if (fileType?.includes('excel') || fileType?.includes('spreadsheet')) return <FileIcon className="w-4 h-4" />;
    if (fileType?.includes('text')) return <FileIcon className="w-4 h-4" />;
    return <FileIcon className="w-4 h-4" />;
  };

  const getTestTypeDisplay = (test) => {
    if (test.testType) return test.testType;
    // Infer from file type
    if (test.fileType?.startsWith('image/')) return 'Image';
    if (test.fileType?.includes('pdf')) return 'PDF Document';
    if (test.fileType?.includes('word')) return 'Word Document';
    if (test.fileType?.includes('excel') || test.fileType?.includes('spreadsheet')) return 'Spreadsheet';
    if (test.fileType?.includes('text')) return 'Text File';
    if (test.fileType?.includes('zip')) return 'Archive';
    return 'Other';
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>Patient not found</p>
        <Link to="/patients" className="text-primary-600 hover:text-primary-700 mt-2 inline-block">Back to Patients</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/patients" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Back to Patients
      </Link>

      {/* Profile Header */}
      <div className="card p-6">
        <div className="flex items-start gap-5">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 text-2xl font-bold">
            {patient.firstName?.charAt(0)}{patient.lastName?.charAt(0)}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{patient.firstName} {patient.lastName}</h1>
            <p className="text-gray-500">
              {patient.gender && (patient.gender === 'PREFER_NOT_TO_SAY' ? 'Prefer not to say' : patient.gender.charAt(0) + patient.gender.slice(1).toLowerCase().replace(/_/g, ' '))}
              {patient.dateOfBirth && ` • ${new Date(patient.dateOfBirth).toLocaleDateString()}`}
            </p>
          </div>
          {patient.bloodType && (
            <span className="badge bg-red-50 text-red-700 text-sm shrink-0">{patient.bloodType.replace('_', ' ')}</span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Phone className="w-4 h-4 text-gray-400" /> {patient.phone}
          </div>
          {patient.email && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Mail className="w-4 h-4 text-gray-400" /> {patient.email}
            </div>
          )}
          {patient.address && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4 text-gray-400" /> {patient.address}
            </div>
          )}
        </div>

        {(patient.allergies || patient.emergencyContact) && (
          <div className="mt-4 flex flex-wrap gap-3">
            {patient.allergies && (
              <span className="badge bg-amber-50 text-amber-700">
                <AlertTriangle className="w-3 h-3 mr-1" /> Allergies: {patient.allergies}
              </span>
            )}
            {patient.emergencyContact && (
              <span className="badge bg-purple-50 text-purple-700">
                <PhoneCall className="w-3 h-3 mr-1" /> Emergency: {patient.emergencyContact} {patient.emergencyPhone && `(${patient.emergencyPhone})`}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Medical Records */}
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-400" />
              Medical Records
            </h2>
          </div>
          <div className="p-5">
            {patient.medicalRecords?.length > 0 ? (
              <div className="space-y-3">
                {patient.medicalRecords.map((record) => (
                  <div key={record.id} className="p-4 rounded-lg bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">{record.diagnosis}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(record.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {record.symptoms && (
                      <p className="text-sm text-gray-600 mb-1">Symptoms: {record.symptoms}</p>
                    )}
                    {record.notes && <p className="text-sm text-gray-500">{record.notes}</p>}
                    <p className="text-xs text-gray-400 mt-2">
                      Dr. {record.doctor?.user?.name}
                    </p>
                    {record.prescriptions?.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <p className="text-xs font-medium text-gray-500 mb-1">Prescriptions:</p>
                        {record.prescriptions.map((p) => (
                          <p key={p.id} className="text-xs text-gray-600">
                            {p.medicationName} - {p.dosage}, {p.frequency}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">No medical records</p>
            )}
          </div>
        </div>

        {/* Appointments */}
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              Recent Appointments
            </h2>
          </div>
          <div className="p-5">
            {patient.appointments?.length > 0 ? (
              <div className="space-y-2">
                {patient.appointments.map((appt) => (
                  <div key={appt.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {appt.doctor?.user?.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(appt.dateTime).toLocaleDateString()} - {new Date(appt.dateTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </p>
                      {appt.reason && <p className="text-xs text-gray-400 mt-0.5">{appt.reason}</p>}
                    </div>
                    <span className={`badge ${
                      appt.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                      appt.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {appt.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">No appointments</p>
            )}
          </div>
        </div>
      </div>

      {/* Medical Tests */}
      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileUp className="w-5 h-5 text-gray-400" />
            Medical Tests & Uploads
          </h2>
          {canUpload && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="btn-sm btn-primary"
            >
              <Upload className="w-3 h-3" />
              Upload File
            </button>
          )}
        </div>
        <div className="p-5">
          {testsLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
            </div>
          ) : medicalTests.length === 0 ? (
            <div className="text-center py-6">
              <FileUp className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-400">No medical test files uploaded yet</p>
              {canUpload && (
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="text-sm text-primary-600 hover:text-primary-700 mt-2 inline-flex items-center gap-1"
                >
                  <Upload className="w-3 h-3" />
                  Upload first file
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="pb-3 font-medium">File</th>
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium">Size</th>
                    <th className="pb-3 font-medium">Uploaded By</th>
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Notes</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {medicalTests.map((test) => (
                    <tr key={test.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="py-3">
                        <button
                          onClick={() => {
                            setPreviewZoom(1);
                            setPreviewTest(test);
                          }}
                          className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium text-left"
                        >
                          {getFileIcon(test.fileType)}
                          <span className="truncate max-w-[200px]">{test.fileName}</span>
                        </button>
                      </td>
                      <td className="py-3">
                        <span className="badge bg-blue-50 text-blue-700 text-xs">
                          {getTestTypeDisplay(test)}
                        </span>
                      </td>
                      <td className="py-3 text-gray-500 text-xs">{formatFileSize(test.fileSize)}</td>
                      <td className="py-3 text-gray-600 text-sm">{test.doctor?.user?.name}</td>
                      <td className="py-3 text-gray-500 text-sm whitespace-nowrap">
                        {new Date(test.uploadedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-gray-500 text-sm max-w-[150px] truncate" title={test.notes || ''}>
                        {test.notes || '-'}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <a
                            href={test.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                            title="Open in new tab"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                          <a
                            href={test.fileUrl}
                            download={test.fileName}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                          {canUpload && (
                            <button
                              onClick={() => handleDeleteTest(test.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Invoices */}
      {patient.invoices?.length > 0 && (
        <div className="card p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-gray-400" />
            Invoices
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-3 font-medium">ID</th>
                  <th className="pb-3 font-medium">Amount</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {patient.invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-gray-50">
                    <td className="py-2 text-gray-900">#{inv.id}</td>
                    <td className="py-2 font-medium">${inv.amount.toFixed(2)}</td>
                    <td className="py-2">
                      <span className={`badge ${
                        inv.status === 'PAID' ? 'bg-green-100 text-green-700' :
                        inv.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>{inv.status.replace('_', ' ')}</span>
                    </td>
                    <td className="py-2 text-gray-500">{new Date(inv.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      {previewTest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setPreviewTest(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-white shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-50 text-primary-600">
                  {getFileIcon(previewTest.fileType)}
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-gray-900 truncate">{previewTest.fileName}</h2>
                  <p className="text-xs text-gray-500">
                    {getTestTypeDisplay(previewTest)} • {formatFileSize(previewTest.fileSize)} • Uploaded {new Date(previewTest.uploadedAt).toLocaleDateString()}
                    {previewTest.doctor?.user?.name && ` by ${previewTest.doctor.user.name}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Image zoom controls */}
                {previewTest.fileType?.startsWith('image/') && (
                  <>
                    <button
                      onClick={() => setPreviewZoom(z => Math.max(0.25, z - 0.25))}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                      title="Zoom out"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-gray-500 font-medium min-w-[3rem] text-center">
                      {Math.round(previewZoom * 100)}%
                    </span>
                    <button
                      onClick={() => setPreviewZoom(z => Math.min(3, z + 0.25))}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                      title="Zoom in"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <div className="w-px h-6 bg-gray-200 mx-1" />
                  </>
                )}
                <a
                  href={previewTest.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-sm btn-secondary"
                >
                  <ExternalLink className="w-3 h-3" />
                  Open
                </a>
                <a
                  href={previewTest.fileUrl}
                  download={previewTest.fileName}
                  className="btn-sm btn-primary"
                >
                  <Download className="w-3 h-3" />
                  Download
                </a>
                <button
                  onClick={() => setPreviewTest(null)}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors ml-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Preview Content */}
            <div className="flex-1 overflow-auto bg-gray-900/5 p-4">
              {previewTest.fileType?.startsWith('image/') ? (
                <div className="flex items-center justify-center min-h-[400px]">
                  <img
                    src={previewTest.fileUrl}
                    alt={previewTest.fileName}
                    className="max-w-full transition-transform duration-200 ease-in-out rounded-lg shadow-lg"
                    style={{ transform: `scale(${previewZoom})`, transformOrigin: 'center center' }}
                    draggable={false}
                  />
                </div>
              ) : previewTest.fileType?.includes('pdf') ? (
                <div className="w-full h-[70vh] rounded-lg overflow-hidden bg-white shadow-inner">
                  <iframe
                    src={`${previewTest.fileUrl}#toolbar=1&navpanes=0`}
                    className="w-full h-full"
                    title={previewTest.fileName}
                  />
                </div>
              ) : previewTest.fileType?.includes('text') ? (
                <div className="flex items-start justify-center min-h-[300px] p-6">
                  <div className="w-full max-w-3xl bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500">Text Preview</span>
                      <a
                        href={previewTest.fileUrl}
                        download={previewTest.fileName}
                        className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        Download
                      </a>
                    </div>
                    <object
                      data={previewTest.fileUrl}
                      type="text/plain"
                      className="w-full h-[50vh]"
                      title={previewTest.fileName}
                    >
                      <div className="flex items-center justify-center h-full p-8">
                        <div className="text-center">
                          <FileIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                          <p className="text-sm text-gray-500">Preview unavailable</p>
                          <a
                            href={previewTest.fileUrl}
                            download={previewTest.fileName}
                            className="btn-sm btn-primary inline-flex mt-3"
                          >
                            <Download className="w-3 h-3" />
                            Download to view
                          </a>
                        </div>
                      </div>
                    </object>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center min-h-[300px]">
                  <div className="text-center p-8">
                    <FileIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-500 text-sm mb-1">
                      {previewTest.fileName}
                    </p>
                    <p className="text-gray-400 text-xs mb-4">
                      {getTestTypeDisplay(previewTest)} • {formatFileSize(previewTest.fileSize)}
                    </p>
                    <a
                      href={previewTest.fileUrl}
                      download={previewTest.fileName}
                      className="btn-sm btn-primary inline-flex"
                    >
                      <Download className="w-3 h-3" />
                      Download file to view
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Footer with notes */}
            {previewTest.notes && (
              <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 shrink-0">
                <p className="text-xs text-gray-500">
                  <span className="font-medium text-gray-600">Notes:</span> {previewTest.notes}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowUploadModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Upload Medical Test File</h2>
              <button onClick={() => setShowUploadModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpload} className="space-y-4">
              {/* File Drop Zone */}
              <div>
                <label className="label">File *</label>
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    uploadForm.file
                      ? 'border-primary-400 bg-primary-50/50'
                      : 'border-gray-300 hover:border-gray-400 bg-gray-50/50'
                  }`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) setUploadForm({ ...uploadForm, file });
                  }}
                  onClick={() => document.getElementById('file-input').click()}
                >
                  {uploadForm.file ? (
                    <div className="flex items-center justify-center gap-2">
                      {getFileIcon(uploadForm.file.type)}
                      <span className="text-sm font-medium text-primary-700">{uploadForm.file.name}</span>
                      <span className="text-xs text-gray-400">({formatFileSize(uploadForm.file.size)})</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm text-gray-500">
                        Drag & drop a file here, or <span className="text-primary-600 font-medium">browse</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-1">PDF, Images, Documents (up to 50MB)</p>
                    </>
                  )}
                </div>
                <input
                  id="file-input"
                  type="file"
                  className="hidden"
                  onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files[0] })}
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt,.zip"
                />
              </div>

              <div>
                <label className="label">Test Type</label>
                <select
                  className="input"
                  value={uploadForm.testType}
                  onChange={(e) => setUploadForm({ ...uploadForm, testType: e.target.value })}
                >
                  <option value="">Select type...</option>
                  <option value="Blood Test">Blood Test</option>
                  <option value="Urinalysis">Urinalysis</option>
                  <option value="X-Ray">X-Ray</option>
                  <option value="MRI">MRI</option>
                  <option value="CT Scan">CT Scan</option>
                  <option value="Ultrasound">Ultrasound</option>
                  <option value="ECG/EKG">ECG/EKG</option>
                  <option value="Biopsy">Biopsy</option>
                  <option value="Pathology Report">Pathology Report</option>
                  <option value="Lab Results">Lab Results</option>
                  <option value="Prescription Scan">Prescription Scan</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="label">Notes</label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="e.g. Routine blood work results"
                  value={uploadForm.notes}
                  onChange={(e) => setUploadForm({ ...uploadForm, notes: e.target.value })}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={uploading}
                >
                  {uploading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                  ) : (
                    <><Upload className="w-4 h-4" /> Upload File</>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="btn-secondary flex-1"
                  disabled={uploading}
                >
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
