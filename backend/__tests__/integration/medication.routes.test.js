const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock Prisma before importing the app
const mockPrismaClient = {
  user: { findUnique: jest.fn() },
  doctor: { findUnique: jest.fn() },
  patient: { findUnique: jest.fn() },
  appointment: { findMany: jest.fn() },
  department: { findMany: jest.fn() },
  medication: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
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

describe('Medication Routes - Integration', () => {
  const adminUser = { id: 1, email: 'admin@clinic.com', name: 'Admin', role: 'ADMIN', isActive: true };
  const doctorUser = { id: 2, email: 'doctor@clinic.com', name: 'Doctor', role: 'DOCTOR', isActive: true };
  const receptionUser = { id: 3, email: 'reception@clinic.com', name: 'Reception', role: 'RECEPTIONIST', isActive: true };

  const adminToken = jwt.sign({ id: 1, email: 'admin@clinic.com', role: 'ADMIN' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const doctorToken = jwt.sign({ id: 2, email: 'doctor@clinic.com', role: 'DOCTOR' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const receptionToken = jwt.sign({ id: 3, email: 'reception@clinic.com', role: 'RECEPTIONIST' }, process.env.JWT_SECRET, { expiresIn: '1h' });

  const sampleMedication = {
    id: 1,
    name: 'Paracetamol',
    description: 'Pain reliever and fever reducer',
    manufacturer: 'PharmaCorp',
    sideEffects: 'Nausea, dizziness',
    dosageForm: 'Tablet 500mg',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };

  const setupAuth = (user) => {
    mockPrismaClient.user.findUnique.mockResolvedValueOnce(user);
    return user;
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  // ─── GET /api/medications ──────────────────────────────────────────────────

  describe('GET /api/medications', () => {
    it('should return all medications without search query', async () => {
      setupAuth(adminUser);
      mockPrismaClient.medication.findMany.mockResolvedValue([sampleMedication]);

      const res = await request(app)
        .get('/api/medications')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Paracetamol');
    });

    it('should search medications by name', async () => {
      setupAuth(adminUser);
      mockPrismaClient.medication.findMany.mockResolvedValue([sampleMedication]);

      const res = await request(app)
        .get('/api/medications?search=Para')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(mockPrismaClient.medication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: { contains: 'Para' } },
          orderBy: { name: 'asc' },
        })
      );
    });

    it('should return empty array when search matches nothing', async () => {
      setupAuth(adminUser);
      mockPrismaClient.medication.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/medications?search=NonExistentDrug')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app).get('/api/medications');
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/medications/:id ──────────────────────────────────────────────

  describe('GET /api/medications/:id', () => {
    it('should return a medication by ID with prescription count', async () => {
      setupAuth(adminUser);
      const medDetail = { ...sampleMedication, _count: { prescriptions: 5 } };
      mockPrismaClient.medication.findUnique.mockResolvedValueOnce(medDetail);

      const res = await request(app)
        .get('/api/medications/1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Paracetamol');
      expect(res.body._count.prescriptions).toBe(5);
    });

    it('should return 404 when medication does not exist', async () => {
      setupAuth(adminUser);
      mockPrismaClient.medication.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .get('/api/medications/999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('message', 'Medication not found.');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app).get('/api/medications/1');
      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/medications ─────────────────────────────────────────────────

  describe('POST /api/medications', () => {
    const createPayload = {
      name: 'Ibuprofen',
      description: 'Anti-inflammatory',
      manufacturer: 'HealthCorp',
      sideEffects: 'Stomach upset',
      dosageForm: 'Tablet 200mg',
    };

    it('should create a medication as ADMIN', async () => {
      setupAuth(adminUser);
      const created = { id: 2, ...createPayload };
      mockPrismaClient.medication.create.mockResolvedValue(created);

      const res = await request(app)
        .post('/api/medications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createPayload);

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Ibuprofen');
      expect(res.body.manufacturer).toBe('HealthCorp');
    });

    it('should return 400 when medication name already exists (P2002)', async () => {
      setupAuth(adminUser);
      const prismaError = new Error('Unique constraint');
      prismaError.code = 'P2002';
      mockPrismaClient.medication.create.mockRejectedValue(prismaError);

      const res = await request(app)
        .post('/api/medications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createPayload);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Medication with this name already exists.');
    });

    it('should return 403 when a DOCTOR tries to create', async () => {
      setupAuth(doctorUser);

      const res = await request(app)
        .post('/api/medications')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(createPayload);

      expect(res.status).toBe(403);
    });

    it('should return 403 when RECEPTIONIST tries to create', async () => {
      setupAuth(receptionUser);

      const res = await request(app)
        .post('/api/medications')
        .set('Authorization', `Bearer ${receptionToken}`)
        .send(createPayload);

      expect(res.status).toBe(403);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/medications')
        .send(createPayload);
      expect(res.status).toBe(401);
    });
  });

  // ─── PUT /api/medications/:id ──────────────────────────────────────────────

  describe('PUT /api/medications/:id', () => {
    it('should update a medication as ADMIN', async () => {
      setupAuth(adminUser);
      const updated = { ...sampleMedication, name: 'Paracetamol Extra', description: 'Stronger pain relief' };
      mockPrismaClient.medication.update.mockResolvedValue(updated);

      const res = await request(app)
        .put('/api/medications/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Paracetamol Extra', description: 'Stronger pain relief' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Paracetamol Extra');
      expect(mockPrismaClient.medication.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { name: 'Paracetamol Extra', description: 'Stronger pain relief', manufacturer: undefined, sideEffects: undefined, dosageForm: undefined },
      });
    });

    it('should return 403 when a DOCTOR tries to update', async () => {
      setupAuth(doctorUser);

      const res = await request(app)
        .put('/api/medications/1')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ name: 'Hacked' });

      expect(res.status).toBe(403);
    });

    it('should return 500 when Prisma throws', async () => {
      setupAuth(adminUser);
      mockPrismaClient.medication.update.mockRejectedValueOnce(new Error('Update failed'));

      const res = await request(app)
        .put('/api/medications/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Fail' });

      expect(res.status).toBe(500);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .put('/api/medications/1')
        .send({ name: 'Hacked' });
      expect(res.status).toBe(401);
    });
  });

  // ─── DELETE /api/medications/:id ───────────────────────────────────────────

  describe('DELETE /api/medications/:id', () => {
    it('should delete a medication as ADMIN', async () => {
      setupAuth(adminUser);
      mockPrismaClient.medication.delete.mockResolvedValue({ id: 1 });

      const res = await request(app)
        .delete('/api/medications/1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Medication deleted successfully.');
    });

    it('should return 403 when a DOCTOR tries to delete', async () => {
      setupAuth(doctorUser);

      const res = await request(app)
        .delete('/api/medications/1')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(403);
    });

    it('should return 403 when RECEPTIONIST tries to delete', async () => {
      setupAuth(receptionUser);

      const res = await request(app)
        .delete('/api/medications/1')
        .set('Authorization', `Bearer ${receptionToken}`);

      expect(res.status).toBe(403);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app).delete('/api/medications/1');
      expect(res.status).toBe(401);
    });
  });
});
