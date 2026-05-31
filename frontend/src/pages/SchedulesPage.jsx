import { useState, useEffect } from 'react';
import { doctorAPI, scheduleAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Clock, Loader2, Save } from 'lucide-react';
import toast from 'react-hot-toast';

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const defaultHours = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

export default function SchedulesPage() {
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { isAdmin, isDoctor } = useAuth();
  const canEdit = isAdmin || isDoctor;

  const [editSchedules, setEditSchedules] = useState(
    dayNames.map((name, i) => ({
      dayOfWeek: i,
      dayName: name,
      enabled: i >= 1 && i <= 5,
      startTime: '09:00',
      endTime: '17:00',
    }))
  );

  useEffect(() => {
    doctorAPI
      .getAll()
      .then((res) => {
        setDoctors(res.data);
        if (res.data.length > 0) {
          setSelectedDoctor(res.data[0].id);
        }
      })
      .catch(() => toast.error('Failed to load doctors'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedDoctor) return;
    setLoading(true);
    scheduleAPI
      .getByDoctor(selectedDoctor)
      .then((res) => {
        const serverSchedules = res.data;
        const updated = editSchedules.map((es) => {
          const server = serverSchedules.find((s) => s.dayOfWeek === es.dayOfWeek);
          return server
            ? { ...es, enabled: server.isAvailable, startTime: server.startTime, endTime: server.endTime }
            : es;
        });
        setEditSchedules(updated);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedDoctor]);

  const handleSave = async () => {
    if (!selectedDoctor) return;
    setSaving(true);
    try {
      const schedulesToSave = editSchedules
        .filter((s) => s.enabled)
        .map((s) => ({
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          isAvailable: true,
        }));

      await scheduleAPI.upsert(selectedDoctor, { schedules: schedulesToSave });
      toast.success('Schedule updated successfully');
    } catch (error) {
      toast.error('Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (dayOfWeek) => {
    setEditSchedules((prev) =>
      prev.map((s) => (s.dayOfWeek === dayOfWeek ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const updateTime = (dayOfWeek, field, value) => {
    setEditSchedules((prev) =>
      prev.map((s) => (s.dayOfWeek === dayOfWeek ? { ...s, [field]: value } : s))
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schedules</h1>
          <p className="text-gray-500 mt-1">Manage doctor weekly schedules</p>
        </div>
      </div>

      {/* Doctor selector */}
      <div className="max-w-md">
        <label className="label">Select Doctor</label>
        <select
          className="input"
          value={selectedDoctor || ''}
          onChange={(e) => setSelectedDoctor(parseInt(e.target.value))}
        >
          <option value="">Choose a doctor...</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>
              {d.user?.name} - {d.specialization}
            </option>
          ))}
        </select>
      </div>

      {selectedDoctor && (
        <>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
          ) : (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-gray-400" />
                  Weekly Hours
                </h2>
                {canEdit && (
                  <button onClick={handleSave} disabled={saving} className="btn-primary">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Saving...' : 'Save Schedule'}
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {editSchedules.map((s) => (
                  <div
                    key={s.dayOfWeek}
                    className={`flex items-center gap-4 p-3 rounded-lg ${
                      s.enabled ? 'bg-gray-50' : 'bg-gray-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 w-32">
                      <input
                        type="checkbox"
                        checked={s.enabled}
                        onChange={() => toggleDay(s.dayOfWeek)}
                        className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        disabled={!canEdit}
                      />
                      <span className={`text-sm font-medium ${s.enabled ? 'text-gray-900' : 'text-gray-400'}`}>
                        {s.dayName}
                      </span>
                    </div>

                    {s.enabled ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={s.startTime}
                          onChange={(e) => updateTime(s.dayOfWeek, 'startTime', e.target.value)}
                          className="input py-1.5 w-28"
                          disabled={!canEdit}
                        >
                          {defaultHours.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                        <span className="text-gray-400">to</span>
                        <select
                          value={s.endTime}
                          onChange={(e) => updateTime(s.dayOfWeek, 'endTime', e.target.value)}
                          className="input py-1.5 w-28"
                          disabled={!canEdit}
                        >
                          {defaultHours.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400 italic">Day off</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
