import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doctorAPI } from '../services/api';
import {
  ArrowLeft,
  Mail,
  Phone,
  Stethoscope,
  Building2,
  Award,
  DollarSign,
  Calendar,
  Clock,
  Loader2,
} from 'lucide-react';

export default function DoctorDetailPage() {
  const { id } = useParams();
  const [doctor, setDoctor] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      doctorAPI.getById(id),
      doctorAPI.getAppointments(id),
    ])
      .then(([docRes, apptRes]) => {
        setDoctor(docRes.data);
        setAppointments(apptRes.data);
      })
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

  if (!doctor) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>Doctor not found</p>
        <Link to="/doctors" className="text-primary-600 hover:text-primary-700 mt-2 inline-block">
          Back to Doctors
        </Link>
      </div>
    );
  }

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="space-y-6">
      <Link to="/doctors" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Back to Doctors
      </Link>

      {/* Profile Header */}
      <div className="card p-6">
        <div className="flex items-start gap-5">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 text-primary-700 text-2xl font-bold">
            {doctor.user?.name?.charAt(0) || 'D'}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{doctor.user?.name}</h1>
            <p className="text-primary-600 font-medium">{doctor.specialization}</p>
            {doctor.bio && <p className="text-gray-500 mt-2 text-sm">{doctor.bio}</p>}
          </div>
          <div className="text-right">
            <span className={`badge ${doctor.isAvailable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {doctor.isAvailable ? 'Available' : 'Unavailable'}
            </span>
            {doctor.consultationFee && (
              <p className="text-lg font-bold text-emerald-600 mt-2">${doctor.consultationFee}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100">
          {doctor.user?.email && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Mail className="w-4 h-4 text-gray-400" />
              {doctor.user.email}
            </div>
          )}
          {doctor.user?.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Phone className="w-4 h-4 text-gray-400" />
              {doctor.user.phone}
            </div>
          )}
          {doctor.licenseNumber && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Award className="w-4 h-4 text-gray-400" />
              License: {doctor.licenseNumber}
            </div>
          )}
        </div>

        {doctor.departments?.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {doctor.departments.map((d) => (
              <span key={d.department.id} className="badge bg-primary-50 text-primary-700">
                <Building2 className="w-3 h-3 mr-1" />
                {d.department.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Schedule */}
        <div className="card p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-400" />
            Weekly Schedule
          </h2>
          {doctor.schedules?.length > 0 ? (
            <div className="space-y-2">
              {doctor.schedules.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50">
                  <span className="font-medium text-sm text-gray-700">{dayNames[s.dayOfWeek]}</span>
                  <span className="text-sm text-gray-500">
                    {s.startTime} - {s.endTime}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">No schedule set</p>
          )}
        </div>

        {/* Recent Appointments */}
        <div className="card p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            Recent Appointments
          </h2>
          {appointments.length > 0 ? (
            <div className="space-y-2">
              {appointments.slice(0, 10).map((appt) => (
                <div
                  key={appt.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {appt.patient?.firstName} {appt.patient?.lastName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(appt.dateTime).toLocaleDateString()} -{' '}
                      {new Date(appt.dateTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </p>
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
  );
}
