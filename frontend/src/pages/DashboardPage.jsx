import { useState, useEffect } from 'react';
import { dashboardAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import {
  Stethoscope,
  Users,
  Calendar,
  DollarSign,
  AlertCircle,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { isAdmin, isDoctor, isReceptionist } = useAuth();

  useEffect(() => {
    dashboardAPI
      .getStats()
      .then((res) => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Doctors',
      value: stats?.totalDoctors || 0,
      icon: Stethoscope,
      color: 'bg-blue-500',
      bg: 'bg-blue-50',
      link: '/doctors',
    },
    {
      label: 'Total Patients',
      value: stats?.totalPatients || 0,
      icon: Users,
      color: 'bg-emerald-500',
      bg: 'bg-emerald-50',
      link: '/patients',
    },
    {
      label: "Today's Appointments",
      value: stats?.todayAppointments || 0,
      icon: Calendar,
      color: 'bg-amber-500',
      bg: 'bg-amber-50',
      link: '/appointments',
    },
    {
      label: 'Pending Invoices',
      value: stats?.pendingInvoices || 0,
      icon: DollarSign,
      color: 'bg-rose-500',
      bg: 'bg-rose-50',
      link: '/invoices',
    },
  ];

  const getStatusBadge = (status) => {
    const styles = {
      SCHEDULED: 'bg-blue-100 text-blue-700',
      CONFIRMED: 'bg-indigo-100 text-indigo-700',
      IN_PROGRESS: 'bg-amber-100 text-amber-700',
      COMPLETED: 'bg-emerald-100 text-emerald-700',
      CANCELLED: 'bg-red-100 text-red-700',
      NO_SHOW: 'bg-gray-100 text-gray-700',
    };
    return styles[status] || styles.SCHEDULED;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Welcome to Doctor Clinic Management System</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Link key={card.label} to={card.link} className="card p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className={`p-2.5 rounded-lg ${card.bg}`}>
                <card.icon className={`w-5 h-5 ${card.color.replace('bg-', 'text-')}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-3">{card.value}</p>
            <p className="text-sm text-gray-500">{card.label}</p>
          </Link>
        ))}
      </div>

      {/* Revenue Card */}
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Total Revenue</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              ${(stats?.totalRevenue || 0).toLocaleString()}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-emerald-50">
            <DollarSign className="w-6 h-6 text-emerald-600" />
          </div>
        </div>
      </div>

      {/* Recent and Upcoming Appointments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Appointments */}
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Today's Appointments</h2>
              <Link
                to="/appointments"
                className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
          <div className="p-5">
            {stats?.recentAppointments?.length > 0 ? (
              <div className="space-y-3">
                {stats.recentAppointments.slice(0, 5).map((appt) => (
                  <div
                    key={appt.id}
                    className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary-50 text-primary-700 text-sm font-semibold">
                        {new Date(appt.dateTime).getHours().toString().padStart(2, '0')}
                        {new Date(appt.dateTime).getMinutes().toString().padStart(2, '0')}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {appt.patient?.firstName} {appt.patient?.lastName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {appt.doctor?.user?.name} - {appt.reason}
                        </p>
                      </div>
                    </div>
                    <span className={`badge ${getStatusBadge(appt.status)}`}>
                      {appt.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">No appointments today</p>
            )}
          </div>
        </div>

        {/* Upcoming Appointments */}
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Upcoming Appointments</h2>
              <Link
                to="/appointments"
                className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
          <div className="p-5">
            {stats?.upcomingAppointments?.length > 0 ? (
              <div className="space-y-3">
                {stats.upcomingAppointments.slice(0, 5).map((appt) => (
                  <div
                    key={appt.id}
                    className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-amber-50 text-amber-700 text-sm font-semibold">
                        {new Date(appt.dateTime).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {appt.patient?.firstName} {appt.patient?.lastName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {appt.doctor?.user?.name} - {new Date(appt.dateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <span className={`badge ${getStatusBadge(appt.status)}`}>
                      {appt.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">No upcoming appointments</p>
            )}
          </div>
        </div>
      </div>

      {/* Appointments by Status */}
      {stats?.appointmentsByStatus?.length > 0 && (
        <div className="card p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Appointments by Status</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {stats.appointmentsByStatus.map((item) => (
              <div key={item.status} className="text-center p-3 rounded-lg bg-gray-50">
                <p className="text-xl font-bold text-gray-900">{item.count}</p>
                <p className="text-xs text-gray-500 mt-1">{item.status.replace('_', ' ')}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
