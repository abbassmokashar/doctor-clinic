const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock Prisma before importing the app
const mockPrismaClient = {
  user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  patient: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  doctor: { findUnique: jest.fn() },
  appointment: { findMany: jest.fn() },
  $transaction: jest.fn((arg) => (typeof arg === 'function' ? arg(mockPrismaClient) : Promise.all(arg))),
  $disconnect: jest.fn(),
};

// Mock WhatsApp and reminder services to prevent Chrome/Puppeteer initialization at import time
jest.mock('../../src/services/whatsapp.service', () => ({
  sendMessage: jest.fn().mockResolvedValue({ success: true, mode: 'console' }),
  getMode: jest.fn().mockReturnValue('console'),
  isClientReady: jest.fn().mockReturnValue(false),
  getConnectionDetails: jest.fn().mockReturnValue({
    status: 'console_mode', mode: 'console', qrDataUrl: null,
    deviceName: null, phoneNumber: null, isConnected: false,
  }),
  resetConnection: jest.fn().mockResolvedValue(undefined),
  sendMedia: jest.fn().mockResolvedValue({ success: true, mode: 'console' }),
  MODE_CONSOLE: 'console',
  MODE_WEB: 'web',
}));

jest.mock('../../src/services/reminder.service', () => ({
  startReminderScheduler: jest.fn(),
  stopReminderScheduler: jest.fn(),
  sendTomorrowReminders: jest.fn(),
  runOnce: jest.fn(),
  buildReminderMessage: jest.fn(),
  sendSingleReminder: jest.fn(),
  getReminderSettings: jest.fn(),
  DEFAULT_TEMPLATE_EN: '',
  DEFAULT_TEMPLATE_AR: '',
}));

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrismaClient),
}));

const app = require('../../src/app');

describe('Patient Routes - Integration', () => {
  const adminUser = { id: 1, email: 'admin@clinic.com', name: 'Admin', role: 'ADMIN', isActive: true };
  const doctorUser = { id: 2, email: 'doctor@clinic.com', name: 'Doctor', role: 'DOCTOR', isActive: true };
  const receptionistUser = { id: 3, email: 'reception@clinic.com', name: 'Reception', role: 'RECEPTIONIST', isActive: true };

  const adminToken = jwt.sign({ id: 1, email: 'admin@clinic.com', role: 'ADMIN' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const doctorToken = jwt.sign({ id: 2, email: 'doctor@clinic.com', role: 'DOCTOR' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const receptionToken = jwt.sign({ id: 3, email: 'reception@clinic.com', role: 'RECEPTIONIST' }, process.env.JWT_SECRET, { expiresIn: '1h' });

  const samplePatient = {
    id: 1,
    firstName: 'John',
    lastName: 'Doe',
    dateOfBirth: null,
    gender: 'Male',
    phone: '1234567890',
    email: 'john@example.com',
    address: '123 Main St',
    bloodType: 'A+',
    allergies: 'None',
    emergencyContact: 'Jane Doe',
    emergencyPhone: '0987654321',
    notes: null,
    userId: null,
    createdAt: new Date('2025-01-15'),
    updatedAt: new Date('2025-01-15'),
    _count: { appointments: 3, medicalRecords: 1, invoices: 2 },
  };

  // Helper: set up authenticate middleware for a given user
  const setupAuth = (user) => {
    mockPrismaClient.user.findUnique.mockResolvedValueOnce(user);
    return user;
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  // ─── GET /api/patients ──────────────────────────────────────────────────────

  describe('GET /api/patients', () => {
    it('should return all patients for an admin', async () => {
      setupAuth(adminUser);
      mockPrismaClient.patient.findMany.mockResolvedValue([samplePatient]);

      const res = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].firstName).toBe('John');
    });

    it('should search patients by name/phone/email for admin', async () => {
      setupAuth(adminUser);
      mockPrismaClient.patient.findMany.mockResolvedValue([samplePatient]);

      const res = await request(app)
        .get('/api/patients?search=John')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(mockPrismaClient.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { firstName: { contains: 'John' } },
              { lastName: { contains: 'John' } },
              { phone: { contains: 'John' } },
              { email: { contains: 'John' } },
            ],
          },
        })
      );
    });

    it('should restrict a doctor to their treated patients', async () => {
      setupAuth(doctorUser);
      mockPrismaClient.doctor.findUnique.mockResolvedValue({ id: 10, userId: 2 });
      mockPrismaClient.appointment.findMany.mockResolvedValue([
        { patientId: 1 },
      ]);
      mockPrismaClient.patient.findMany.mockResolvedValue([samplePatient]);

      const res = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(mockPrismaClient.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: [1] },
          }),
        })
      );
    });

    it('should return empty array if doctor has no patient history', async () => {
      setupAuth(doctorUser);
      mockPrismaClient.doctor.findUnique.mockResolvedValue({ id: 10, userId: 2 });
      mockPrismaClient.appointment.findMany.mockResolvedValue([]);
      mockPrismaClient.patient.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should return empty array if doctor record does not exist (edge case)', async () => {
      setupAuth(doctorUser);
      mockPrismaClient.doctor.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app).get('/api/patients');

      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/patients/:id ─────────────────────────────────────────────────

  describe('GET /api/patients/:id', () => {
    it('should return a patient by ID with full details', async () => {
      setupAuth(adminUser);
      const fullPatient = {
        ...samplePatient,
        user: { id: 4, email: 'john@example.com', name: 'John Doe' },
        appointments: [],
        medicalRecords: [],
        invoices: [],
      };
      mockPrismaClient.patient.findUnique.mockResolvedValueOnce(fullPatient);

      const res = await request(app)
        .get('/api/patients/1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(1);
      expect(res.body.firstName).toBe('John');
      expect(res.body).toHaveProperty('appointments');
      expect(res.body).toHaveProperty('medicalRecords');
      expect(res.body).toHaveProperty('invoices');
      expect(mockPrismaClient.patient.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          include: expect.objectContaining({
            user: { select: { id: true, email: true, name: true } },
          }),
        })
      );
    });

    it('should return 404 when patient does not exist', async () => {
      setupAuth(adminUser);
      mockPrismaClient.patient.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .get('/api/patients/999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('message', 'Patient not found.');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app).get('/api/patients/1');

      expect(res.status).toBe(401);
    });

    it('should return 500 when Prisma throws', async () => {
      setupAuth(adminUser);
      mockPrismaClient.patient.findUnique.mockRejectedValueOnce(new Error('DB error'));

      const res = await request(app)
        .get('/api/patients/1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(500);
    });
  });

  // ─── POST /api/patients ────────────────────────────────────────────────────

  describe('POST /api/patients', () => {
    const newPatientPayload = {
      firstName: 'Jane',
      lastName: 'Smith',
      dateOfBirth: '1990-06-15',
      gender: 'Female',
      phone: '5551234567',
      email: 'jane@example.com',
      address: '456 Oak Ave',
      bloodType: 'O+',
      allergies: 'Penicillin',
      emergencyContact: 'Bob Smith',
      emergencyPhone: '5559876543',
      notes: 'New patient',
    };

    it('should create a patient as ADMIN', async () => {
      setupAuth(adminUser);
      const createdPatient = { id: 2, ...newPatientPayload, dateOfBirth: new Date('1990-06-15'), createdAt: new Date(), updatedAt: new Date() };
      mockPrismaClient.patient.create.mockResolvedValue(createdPatient);

      const res = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newPatientPayload);

      expect(res.status).toBe(201);
      expect(res.body.firstName).toBe('Jane');
      expect(res.body.lastName).toBe('Smith');
    });

    it('should create a patient as DOCTOR', async () => {
      setupAuth(doctorUser);
      const createdPatient = { id: 3, ...newPatientPayload, dateOfBirth: new Date('1990-06-15'), createdAt: new Date(), updatedAt: new Date() };
      mockPrismaClient.patient.create.mockResolvedValue(createdPatient);

      const res = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(newPatientPayload);

      expect(res.status).toBe(201);
    });

    it('should create a patient as RECEPTIONIST', async () => {
      setupAuth(receptionistUser);
      const createdPatient = { id: 4, ...newPatientPayload, dateOfBirth: new Date('1990-06-15'), createdAt: new Date(), updatedAt: new Date() };
      mockPrismaClient.patient.create.mockResolvedValue(createdPatient);

      const res = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${receptionToken}`)
        .send(newPatientPayload);

      expect(res.status).toBe(201);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/patients')
        .send(newPatientPayload);

      expect(res.status).toBe(401);
    });
  });

  // ─── PUT /api/patients/:id ─────────────────────────────────────────────────

  describe('PUT /api/patients/:id', () => {
    it('should update a patient as ADMIN', async () => {
      setupAuth(adminUser);
      const updated = { id: 1, firstName: 'Updated', lastName: 'Doe', phone: '9998887777' };
      mockPrismaClient.patient.update.mockResolvedValue(updated);

      const res = await request(app)
        .put('/api/patients/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Updated', phone: '9998887777' });

      expect(res.status).toBe(200);
      expect(res.body.firstName).toBe('Updated');
      expect(res.body.phone).toBe('9998887777');
      expect(mockPrismaClient.patient.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({ firstName: 'Updated', phone: '9998887777' }),
      });
    });

    it('should update a patient as DOCTOR', async () => {
      setupAuth(doctorUser);
      mockPrismaClient.patient.update.mockResolvedValue({ id: 1, firstName: 'Updated' });

      const res = await request(app)
        .put('/api/patients/1')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ firstName: 'Updated' });

      expect(res.status).toBe(200);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .put('/api/patients/1')
        .send({ firstName: 'Hacker' });

      expect(res.status).toBe(401);
    });

    it('should return 500 when Prisma throws', async () => {
      setupAuth(adminUser);
      mockPrismaClient.patient.update.mockRejectedValueOnce(new Error('Update failed'));

      const res = await request(app)
        .put('/api/patients/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Fail' });

      expect(res.status).toBe(500);
    });
  });

  // ─── DELETE /api/patients/:id ───────────────────────────────────────────────

  describe('DELETE /api/patients/:id', () => {
    it('should delete a patient as ADMIN', async () => {
      setupAuth(adminUser);
      mockPrismaClient.patient.delete.mockResolvedValue({ id: 1 });

      const res = await request(app)
        .delete('/api/patients/1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Patient deleted successfully.');
      expect(mockPrismaClient.patient.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should return 403 when a DOCTOR tries to delete', async () => {
      setupAuth(doctorUser);
      mockPrismaClient.patient.delete.mockResolvedValue({ id: 1 });

      const res = await request(app)
        .delete('/api/patients/1')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('message', 'Insufficient permissions.');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app).delete('/api/patients/1');

      expect(res.status).toBe(401);
    });

    it('should return 500 when Prisma throws', async () => {
      setupAuth(adminUser);
      mockPrismaClient.patient.delete.mockRejectedValueOnce(new Error('Delete failed'));

      const res = await request(app)
        .delete('/api/patients/1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(500);
    });
  });
});
