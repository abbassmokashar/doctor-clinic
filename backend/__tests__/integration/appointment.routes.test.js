const request = require('supertest');
const jwt = require('jsonwebtoken');

// Helper to generate a future ISO datetime string
const futureDateTime = (hoursFromNow = 48) => {
  const d = new Date();
  d.setHours(d.getHours() + hoursFromNow);
  return d.toISOString().slice(0, 16);
};

// Mock Prisma before importing the app
const mockPrismaClient = {
  user: { findUnique: jest.fn() },
  doctor: { findUnique: jest.fn() },
  patient: { findMany: jest.fn(), findUnique: jest.fn() },
  appointment: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
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

describe('Appointment Routes - Integration', () => {
  const adminUser = { id: 1, email: 'admin@clinic.com', name: 'Admin', role: 'ADMIN', isActive: true };
  const doctorUser = { id: 2, email: 'doctor@clinic.com', name: 'Doctor', role: 'DOCTOR', isActive: true };
  const receptionUser = { id: 3, email: 'reception@clinic.com', name: 'Reception', role: 'RECEPTIONIST', isActive: true };

  const adminToken = jwt.sign({ id: 1, email: 'admin@clinic.com', role: 'ADMIN' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const doctorToken = jwt.sign({ id: 2, email: 'doctor@clinic.com', role: 'DOCTOR' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const receptionToken = jwt.sign({ id: 3, email: 'reception@clinic.com', role: 'RECEPTIONIST' }, process.env.JWT_SECRET, { expiresIn: '1h' });

  const sampleAppointment = {
    id: 1,
    doctorId: 10,
    patientId: 20,
    dateTime: new Date('2026-07-10T10:00:00Z'),
    duration: 30,
    status: 'SCHEDULED',
    reason: 'Regular checkup',
    notes: null,
    doctor: { id: 10, user: { name: 'Dr. Smith' } },
    patient: { id: 20, firstName: 'John', lastName: 'Doe', phone: '1234567890' },
  };

  const fullAppointment = {
    ...sampleAppointment,
    doctor: { id: 10, user: { name: 'Dr. Smith', email: 'dr@clinic.com' } },
    patient: { id: 20, firstName: 'John', lastName: 'Doe', phone: '1234567890', email: 'john@test.com' },
    medicalRecord: null,
    invoice: null,
  };

  const setupAuth = (user) => {
    mockPrismaClient.user.findUnique.mockResolvedValueOnce(user);
    return user;
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  // ─── GET /api/appointments ─────────────────────────────────────────────────

  describe('GET /api/appointments', () => {
    it('should return all appointments for admin', async () => {
      setupAuth(adminUser);
      mockPrismaClient.appointment.findMany.mockResolvedValue([sampleAppointment]);

      const res = await request(app)
        .get('/api/appointments')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].doctor.user.name).toBe('Dr. Smith');
      expect(res.body[0].patient.firstName).toBe('John');
    });

    it('should filter by status query param', async () => {
      setupAuth(adminUser);
      mockPrismaClient.appointment.findMany.mockResolvedValue([sampleAppointment]);

      await request(app)
        .get('/api/appointments?status=SCHEDULED')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(mockPrismaClient.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'SCHEDULED' }),
        })
      );
    });

    it('should filter by doctorId query param', async () => {
      setupAuth(adminUser);
      mockPrismaClient.appointment.findMany.mockResolvedValue([sampleAppointment]);

      await request(app)
        .get('/api/appointments?doctorId=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(mockPrismaClient.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ doctorId: 10 }),
        })
      );
    });

    it('should filter by date query param', async () => {
      setupAuth(adminUser);
      mockPrismaClient.appointment.findMany.mockResolvedValue([sampleAppointment]);

      await request(app)
        .get('/api/appointments?date=2026-07-10')
        .set('Authorization', `Bearer ${adminToken}`);

      const callArg = mockPrismaClient.appointment.findMany.mock.calls[0][0];
      expect(callArg.where.dateTime).toBeDefined();
      expect(callArg.where.dateTime.gte).toBeInstanceOf(Date);
      expect(callArg.where.dateTime.lte).toBeInstanceOf(Date);
    });

    it('should restrict doctors to their own appointments', async () => {
      setupAuth(doctorUser);
      mockPrismaClient.doctor.findUnique.mockResolvedValue({ id: 5, userId: 2 });
      mockPrismaClient.appointment.findMany.mockResolvedValue([sampleAppointment]);

      const res = await request(app)
        .get('/api/appointments')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(200);
      expect(mockPrismaClient.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ doctorId: 5 }),
        })
      );
    });

    it('should return empty array if doctor has no profile record', async () => {
      setupAuth(doctorUser);
      mockPrismaClient.doctor.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/appointments')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app).get('/api/appointments');
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/appointments/today ───────────────────────────────────────────

  describe('GET /api/appointments/today', () => {
    it('should return today appointments', async () => {
      setupAuth(adminUser);
      mockPrismaClient.appointment.findMany.mockResolvedValue([sampleAppointment]);

      const res = await request(app)
        .get('/api/appointments/today')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // The controller builds gte/lte for today's date range
      expect(mockPrismaClient.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { dateTime: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }) },
        })
      );
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app).get('/api/appointments/today');
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/appointments/:id ─────────────────────────────────────────────

  describe('GET /api/appointments/:id', () => {
    it('should return an appointment by ID with full details', async () => {
      setupAuth(adminUser);
      mockPrismaClient.appointment.findUnique.mockResolvedValueOnce(fullAppointment);

      const res = await request(app)
        .get('/api/appointments/1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(1);
      expect(res.body.patient.firstName).toBe('John');
      expect(res.body).toHaveProperty('medicalRecord');
      expect(res.body).toHaveProperty('invoice');
    });

    it('should return 404 when appointment does not exist', async () => {
      setupAuth(adminUser);
      mockPrismaClient.appointment.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .get('/api/appointments/999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('message', 'Appointment not found.');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app).get('/api/appointments/1');
      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/appointments ────────────────────────────────────────────────

  describe('POST /api/appointments', () => {
    const createPayload = () => ({
      doctorId: 10,
      patientId: 20,
      dateTime: futureDateTime(48),
      duration: 30,
      reason: 'Annual checkup',
    });

    it('should create an appointment as ADMIN', async () => {
      setupAuth(adminUser);
      // First findMany returns empty (no doctor overlap), second findMany returns empty (no patient overlap)
      mockPrismaClient.appointment.findMany
        .mockResolvedValueOnce([]) // doctor overlap check
        .mockResolvedValueOnce([]); // patient overlap check
      const created = { id: 5, ...createPayload(), dateTime: new Date(createPayload().dateTime) };
      mockPrismaClient.appointment.create.mockResolvedValue(created);

      const res = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createPayload());

      expect(res.status).toBe(201);
      expect(res.body.id).toBe(5);
      expect(mockPrismaClient.appointment.create).toHaveBeenCalled();
    });

    it('should create an appointment as DOCTOR', async () => {
      setupAuth(doctorUser);
      mockPrismaClient.appointment.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockPrismaClient.appointment.create.mockResolvedValue({ id: 6 });

      const res = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(createPayload());

      expect(res.status).toBe(201);
    });

    it('should create an appointment as RECEPTIONIST', async () => {
      setupAuth(receptionUser);
      mockPrismaClient.appointment.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockPrismaClient.appointment.create.mockResolvedValue({ id: 7 });

      const res = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${receptionToken}`)
        .send(createPayload());

      expect(res.status).toBe(201);
    });

    it('should return 400 when appointment time is in the past', async () => {
      setupAuth(adminUser);

      const res = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          doctorId: 10,
          patientId: 20,
          dateTime: '2020-01-01T10:00',
          duration: 30,
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Cannot create an appointment in the past. Please select a future date and time.');
      expect(mockPrismaClient.appointment.create).not.toHaveBeenCalled();
    });

    it('should return 409 when doctor has an overlapping appointment', async () => {
      setupAuth(adminUser);
      const payload = createPayload();
      const futureDate = new Date(payload.dateTime);
      const overlappingAppt = {
        id: 99,
        dateTime: futureDate,
        duration: 30,
      };
      mockPrismaClient.appointment.findMany
        .mockResolvedValueOnce([overlappingAppt]) // doctor overlap check finds conflict
        .mockResolvedValueOnce([]); // patient check never reached

      const res = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('message', 'Doctor has an overlapping appointment.');
    });

    it('should return 409 when patient has an overlapping appointment', async () => {
      setupAuth(adminUser);
      const payload = createPayload();
      const futureDate = new Date(payload.dateTime);
      const overlappingPatientAppt = {
        id: 98,
        dateTime: futureDate,
        duration: 30,
      };
      mockPrismaClient.appointment.findMany
        .mockResolvedValueOnce([]) // doctor overlap check passes
        .mockResolvedValueOnce([overlappingPatientAppt]); // patient overlap check finds conflict

      const res = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('message', 'Patient already has an appointment at this time.');
    });

    it('should default duration to 30 when not provided', async () => {
      setupAuth(adminUser);
      mockPrismaClient.appointment.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockPrismaClient.appointment.create.mockResolvedValue({ id: 8 });

      const { duration, ...payloadWithoutDuration } = createPayload();

      await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(payloadWithoutDuration);

      expect(mockPrismaClient.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ duration: 30 }),
        })
      );
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/appointments')
        .send(createPayload());
      expect(res.status).toBe(401);
    });
  });

  // ─── PUT /api/appointments/:id ─────────────────────────────────────────────

  describe('PUT /api/appointments/:id', () => {
    it('should update appointment status as ADMIN', async () => {
      setupAuth(adminUser);
      const updated = { ...sampleAppointment, status: 'CONFIRMED' };
      mockPrismaClient.appointment.update.mockResolvedValue(updated);

      const res = await request(app)
        .put('/api/appointments/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'CONFIRMED' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CONFIRMED');
    });

    it('should check for doctor overlap when changing doctor', async () => {
      setupAuth(adminUser);
      // When doctorId changes, update logic fetches current appointment to get dateTime + duration
      mockPrismaClient.appointment.findUnique.mockResolvedValueOnce({
        id: 1,
        doctorId: 10,
        patientId: 20,
        dateTime: new Date('2026-07-10T10:00:00Z'),
        duration: 30,
      });
      // No overlapping appointments
      mockPrismaClient.appointment.findMany
        .mockResolvedValueOnce([]) // doctor overlap check
        .mockResolvedValueOnce([]); // patient overlap check
      mockPrismaClient.appointment.update.mockResolvedValue({ ...sampleAppointment, doctorId: 11 });

      const res = await request(app)
        .put('/api/appointments/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ doctorId: 11 });

      expect(res.status).toBe(200);
    });

    it('should return 409 on doctor overlap during update', async () => {
      setupAuth(adminUser);
      mockPrismaClient.appointment.findUnique.mockResolvedValueOnce({
        id: 1,
        doctorId: 10,
        dateTime: new Date('2026-07-10T10:00:00Z'),
        duration: 30,
      });
      // Simulate an overlapping appointment
      mockPrismaClient.appointment.findMany.mockResolvedValueOnce([
        { id: 99, dateTime: new Date('2026-07-10T10:00:00Z'), duration: 30 },
      ]);

      const res = await request(app)
        .put('/api/appointments/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ doctorId: 11 });

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('message', 'Doctor has an overlapping appointment.');
    });

    it('should return 404 when updating non-existent appointment (with doctor change)', async () => {
      setupAuth(adminUser);
      // Send only doctorId (no dateTime) so effectiveDateTime is undefined,
      // forcing the controller into the overlap-check findUnique block
      mockPrismaClient.appointment.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .put('/api/appointments/999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ doctorId: 11 });

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('message', 'Appointment not found.');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .put('/api/appointments/1')
        .send({ status: 'CONFIRMED' });
      expect(res.status).toBe(401);
    });
  });

  // ─── DELETE /api/appointments/:id ──────────────────────────────────────────

  describe('DELETE /api/appointments/:id', () => {
    it('should delete an appointment as ADMIN', async () => {
      setupAuth(adminUser);
      mockPrismaClient.appointment.delete.mockResolvedValue({ id: 1 });

      const res = await request(app)
        .delete('/api/appointments/1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Appointment deleted successfully.');
    });

    it('should return 403 when a DOCTOR tries to delete', async () => {
      setupAuth(doctorUser);

      const res = await request(app)
        .delete('/api/appointments/1')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('message', 'Insufficient permissions.');
    });

    it('should return 403 when RECEPTIONIST tries to delete', async () => {
      setupAuth(receptionUser);

      const res = await request(app)
        .delete('/api/appointments/1')
        .set('Authorization', `Bearer ${receptionToken}`);

      expect(res.status).toBe(403);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app).delete('/api/appointments/1');
      expect(res.status).toBe(401);
    });
  });
});
