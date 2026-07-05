const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock Prisma before importing the app
const mockPrismaClient = {
  user: { findUnique: jest.fn() },
  doctor: { findUnique: jest.fn() },
  patient: { findUnique: jest.fn() },
  appointment: { findMany: jest.fn() },
  department: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  doctorDepartment: { create: jest.fn(), delete: jest.fn() },
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

describe('Department Routes - Integration', () => {
  const adminUser = { id: 1, email: 'admin@clinic.com', name: 'Admin', role: 'ADMIN', isActive: true };
  const doctorUser = { id: 2, email: 'doctor@clinic.com', name: 'Doctor', role: 'DOCTOR', isActive: true };
  const receptionUser = { id: 3, email: 'reception@clinic.com', name: 'Reception', role: 'RECEPTIONIST', isActive: true };

  const adminToken = jwt.sign({ id: 1, email: 'admin@clinic.com', role: 'ADMIN' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const doctorToken = jwt.sign({ id: 2, email: 'doctor@clinic.com', role: 'DOCTOR' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const receptionToken = jwt.sign({ id: 3, email: 'reception@clinic.com', role: 'RECEPTIONIST' }, process.env.JWT_SECRET, { expiresIn: '1h' });

  const sampleDepartment = {
    id: 1,
    name: 'Cardiology',
    description: 'Heart and cardiovascular system',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    _count: { doctors: 2 },
    doctors: [
      {
        id: 1,
        doctorId: 10,
        departmentId: 1,
        doctor: { id: 10, user: { name: 'Dr. Smith' } },
      },
    ],
  };

  const setupAuth = (user) => {
    mockPrismaClient.user.findUnique.mockResolvedValueOnce(user);
    return user;
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  // ─── GET /api/departments ──────────────────────────────────────────────────

  describe('GET /api/departments', () => {
    it('should return all departments with doctor counts', async () => {
      setupAuth(adminUser);
      mockPrismaClient.department.findMany.mockResolvedValue([sampleDepartment]);

      const res = await request(app)
        .get('/api/departments')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Cardiology');
      expect(res.body[0]._count.doctors).toBe(2);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app).get('/api/departments');
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/departments/:id ──────────────────────────────────────────────

  describe('GET /api/departments/:id', () => {
    it('should return a department by ID with doctors', async () => {
      setupAuth(adminUser);
      const deptDetail = {
        ...sampleDepartment,
        doctors: [
          {
            id: 1,
            doctorId: 10,
            departmentId: 1,
            doctor: { id: 10, user: { id: 2, email: 'dr@clinic.com', name: 'Dr. Smith' } },
          },
        ],
      };
      mockPrismaClient.department.findUnique.mockResolvedValueOnce(deptDetail);

      const res = await request(app)
        .get('/api/departments/1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Cardiology');
      expect(res.body.doctors).toHaveLength(1);
    });

    it('should return 404 when department does not exist', async () => {
      setupAuth(adminUser);
      mockPrismaClient.department.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .get('/api/departments/999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('message', 'Department not found.');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app).get('/api/departments/1');
      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/departments ─────────────────────────────────────────────────

  describe('POST /api/departments', () => {
    it('should create a department as ADMIN', async () => {
      setupAuth(adminUser);
      const created = { id: 3, name: 'Neurology', description: 'Brain and nerves' };
      mockPrismaClient.department.create.mockResolvedValue(created);

      const res = await request(app)
        .post('/api/departments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Neurology', description: 'Brain and nerves' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Neurology');
    });

    it('should return 400 when department name already exists (P2002)', async () => {
      setupAuth(adminUser);
      const prismaError = new Error('Unique constraint');
      prismaError.code = 'P2002';
      mockPrismaClient.department.create.mockRejectedValue(prismaError);

      const res = await request(app)
        .post('/api/departments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Cardiology' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Department with this name already exists.');
    });

    it('should return 403 when a DOCTOR tries to create', async () => {
      setupAuth(doctorUser);

      const res = await request(app)
        .post('/api/departments')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ name: 'New Dept' });

      expect(res.status).toBe(403);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/departments')
        .send({ name: 'Ghost Dept' });
      expect(res.status).toBe(401);
    });
  });

  // ─── PUT /api/departments/:id ──────────────────────────────────────────────

  describe('PUT /api/departments/:id', () => {
    it('should update a department as ADMIN', async () => {
      setupAuth(adminUser);
      const updated = { id: 1, name: 'Cardiology Updated', description: 'Updated description' };
      mockPrismaClient.department.update.mockResolvedValue(updated);

      const res = await request(app)
        .put('/api/departments/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Cardiology Updated', description: 'Updated description' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Cardiology Updated');
    });

    it('should return 403 when a RECEPTIONIST tries to update', async () => {
      setupAuth(receptionUser);

      const res = await request(app)
        .put('/api/departments/1')
        .set('Authorization', `Bearer ${receptionToken}`)
        .send({ name: 'Hacked' });

      expect(res.status).toBe(403);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .put('/api/departments/1')
        .send({ name: 'Hacked' });
      expect(res.status).toBe(401);
    });
  });

  // ─── DELETE /api/departments/:id ───────────────────────────────────────────

  describe('DELETE /api/departments/:id', () => {
    it('should delete a department as ADMIN', async () => {
      setupAuth(adminUser);
      mockPrismaClient.department.delete.mockResolvedValue({ id: 1 });

      const res = await request(app)
        .delete('/api/departments/1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Department deleted successfully.');
    });

    it('should return 403 when a DOCTOR tries to delete', async () => {
      setupAuth(doctorUser);

      const res = await request(app)
        .delete('/api/departments/1')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(403);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app).delete('/api/departments/1');
      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/departments/:id/doctors ─────────────────────────────────────

  describe('POST /api/departments/:id/doctors', () => {
    it('should add a doctor to a department as ADMIN', async () => {
      setupAuth(adminUser);
      const relation = {
        id: 5,
        doctorId: 10,
        departmentId: 1,
        doctor: { id: 10, user: { name: 'Dr. Smith' } },
        department: { id: 1, name: 'Cardiology' },
      };
      mockPrismaClient.doctorDepartment.create.mockResolvedValue(relation);

      const res = await request(app)
        .post('/api/departments/1/doctors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ doctorId: 10 });

      expect(res.status).toBe(201);
      expect(res.body.doctorId).toBe(10);
      expect(res.body.departmentId).toBe(1);
    });

    it('should return 400 when doctor is already in the department (P2002)', async () => {
      setupAuth(adminUser);
      const prismaError = new Error('Unique constraint');
      prismaError.code = 'P2002';
      mockPrismaClient.doctorDepartment.create.mockRejectedValue(prismaError);

      const res = await request(app)
        .post('/api/departments/1/doctors')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ doctorId: 10 });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Doctor already in this department.');
    });

    it('should return 403 when a DOCTOR tries to add a doctor', async () => {
      setupAuth(doctorUser);

      const res = await request(app)
        .post('/api/departments/1/doctors')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ doctorId: 10 });

      expect(res.status).toBe(403);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/departments/1/doctors')
        .send({ doctorId: 10 });
      expect(res.status).toBe(401);
    });
  });

  // ─── DELETE /api/departments/:id/doctors/:doctorId ─────────────────────────

  describe('DELETE /api/departments/:id/doctors/:doctorId', () => {
    it('should remove a doctor from a department as ADMIN', async () => {
      setupAuth(adminUser);
      mockPrismaClient.doctorDepartment.delete.mockResolvedValue({ id: 5 });

      const res = await request(app)
        .delete('/api/departments/1/doctors/10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Doctor removed from department.');
      expect(mockPrismaClient.doctorDepartment.delete).toHaveBeenCalledWith({
        where: {
          doctorId_departmentId: { doctorId: 10, departmentId: 1 },
        },
      });
    });

    it('should return 403 when a RECEPTIONIST tries to remove a doctor', async () => {
      setupAuth(receptionUser);

      const res = await request(app)
        .delete('/api/departments/1/doctors/10')
        .set('Authorization', `Bearer ${receptionToken}`);

      expect(res.status).toBe(403);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app).delete('/api/departments/1/doctors/10');
      expect(res.status).toBe(401);
    });
  });
});
