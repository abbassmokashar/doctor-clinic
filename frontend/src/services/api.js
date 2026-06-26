import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/profile', data),
};

// Doctors
export const doctorAPI = {
  getAll: () => api.get('/doctors'),
  getById: (id) => api.get(`/doctors/${id}`),
  create: (data) => api.post('/doctors', data),
  update: (id, data) => api.put(`/doctors/${id}`, data),
  delete: (id) => api.delete(`/doctors/${id}`),
  getAppointments: (id) => api.get(`/doctors/${id}/appointments`),
};

// Patients
export const patientAPI = {
  getAll: (params) => api.get('/patients', { params }),
  getById: (id) => api.get(`/patients/${id}`),
  create: (data) => api.post('/patients', data),
  update: (id, data) => api.put(`/patients/${id}`, data),
  delete: (id) => api.delete(`/patients/${id}`),
};

// Appointments
export const appointmentAPI = {
  getAll: (params) => api.get('/appointments', { params }),
  getToday: () => api.get('/appointments/today'),
  getById: (id) => api.get(`/appointments/${id}`),
  create: (data) => api.post('/appointments', data),
  update: (id, data) => api.put(`/appointments/${id}`, data),
  delete: (id) => api.delete(`/appointments/${id}`),
};

// Schedules
export const scheduleAPI = {
  getByDoctor: (doctorId) => api.get(`/schedules/doctor/${doctorId}`),
  upsert: (doctorId, data) => api.put(`/schedules/doctor/${doctorId}`, data),
  update: (id, data) => api.put(`/schedules/${id}`, data),
  delete: (id) => api.delete(`/schedules/${id}`),
};

// Medical Records
export const medicalRecordAPI = {
  getByPatient: (patientId) => api.get(`/medical-records/patient/${patientId}`),
  getById: (id) => api.get(`/medical-records/${id}`),
  create: (data) => api.post('/medical-records', data),
  update: (id, data) => api.put(`/medical-records/${id}`, data),
  delete: (id) => api.delete(`/medical-records/${id}`),
};

// Medications
export const medicationAPI = {
  getAll: (params) => api.get('/medications', { params }),
  getById: (id) => api.get(`/medications/${id}`),
  create: (data) => api.post('/medications', data),
  update: (id, data) => api.put(`/medications/${id}`, data),
  delete: (id) => api.delete(`/medications/${id}`),
};

// Prescriptions
export const prescriptionAPI = {
  getByMedicalRecord: (medicalRecordId) => api.get(`/prescriptions/medical-record/${medicalRecordId}`),
  getByPatient: (patientId) => api.get(`/prescriptions/patient/${patientId}`),
  create: (data) => api.post('/prescriptions', data),
  update: (id, data) => api.put(`/prescriptions/${id}`, data),
  delete: (id) => api.delete(`/prescriptions/${id}`),
};

// Departments
export const departmentAPI = {
  getAll: () => api.get('/departments'),
  getById: (id) => api.get(`/departments/${id}`),
  create: (data) => api.post('/departments', data),
  update: (id, data) => api.put(`/departments/${id}`, data),
  delete: (id) => api.delete(`/departments/${id}`),
  addDoctor: (id, data) => api.post(`/departments/${id}/doctors`, data),
  removeDoctor: (id, doctorId) => api.delete(`/departments/${id}/doctors/${doctorId}`),
};

// Invoices
export const invoiceAPI = {
  getAll: (params) => api.get('/invoices', { params }),
  getById: (id) => api.get(`/invoices/${id}`),
  create: (data) => api.post('/invoices', data),
  update: (id, data) => api.put(`/invoices/${id}`, data),
  delete: (id) => api.delete(`/invoices/${id}`),
  markPaid: (id, data) => api.patch(`/invoices/${id}/pay`, data),
};

// Medical Tests
export const medicalTestAPI = {
  getByPatient: (patientId) => api.get(`/medical-tests/patient/${patientId}`),
  getById: (id) => api.get(`/medical-tests/${id}`),
  upload: (formData) => api.post('/medical-tests/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  delete: (id) => api.delete(`/medical-tests/${id}`),
};

// Reminders
export const reminderAPI = {
  trigger: (params) => api.post('/reminders/trigger', null, { params }),
  sendForAppointment: (appointmentId) => api.post(`/reminders/send/${appointmentId}`),
};

// Dashboard
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
};

// Settings
export const settingsAPI = {
  getAll: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
  getUsers: () => api.get('/settings/users'),
  updateUser: (id, data) => api.put(`/settings/users/${id}`, data),
};

// WhatsApp
export const whatsappAPI = {
  getStatus: () => api.get('/whatsapp/status'),
  disconnect: () => api.post('/whatsapp/disconnect'),
};

// Backup
export const backupAPI = {
  getInfo: () => api.get('/backup/info'),
  download: () => api.get('/backup/download', { responseType: 'blob' }),
  restore: (formData) => api.post('/backup/restore', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

export default api;
