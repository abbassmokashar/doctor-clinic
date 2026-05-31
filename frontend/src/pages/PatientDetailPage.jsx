import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { patientAPI } from '../services/api';
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
} from 'lucide-react';

export default function PatientDetailPage() {
  const { id } = useParams();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    patientAPI
      .getById(id)
      .then((res) => setPatient(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

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
              {patient.gender && `${patient.gender.charAt(0) + patient.gender.slice(1).toLowerCase()}`}
              {patient.dateOfBirth && ` • ${new Date(patient.dateOfBirth).toLocaleDateString()}`}
            </p>
          </div>            {patient.bloodType && (
            <span className="badge bg-red-50 text-red-700 text-sm">{patient.bloodType.replace('_', ' ')}</span>
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
    </div>
  );
}
