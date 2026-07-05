const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Mock Prisma before importing the app
const mockPrismaClient = {
  user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  doctor: { findUnique: jest.fn() },
  patient: { findUnique: jest.fn() },
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

describe('Auth Routes - Integration', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  const validUser = {
    id: 1,
    email: 'admin@clinic.com',
    password: 'hashed_password_123',
    name: 'Admin User',
    role: 'ADMIN',
    phone: '1234567890',
    isActive: true,
    createdAt: new Date('2025-01-01'),
  };

  const profileData = {
    id: 1,
    email: 'admin@clinic.com',
    name: 'Admin User',
    role: 'ADMIN',
    phone: '1234567890',
    isActive: true,
    createdAt: new Date('2025-01-01'),
    doctor: null,
    patient: null,
  };

  const adminToken = jwt.sign(
    { id: 1, email: 'admin@clinic.com', role: 'ADMIN' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Helper to set up the authenticate middleware to pass
  const setupAuth = (userOverrides = {}) => {
    const user = { ...validUser, ...userOverrides };
    mockPrismaClient.user.findUnique.mockResolvedValueOnce(user);
    return user;
  };

  // ─── POST /api/auth/register ────────────────────────────────────────────────

  describe('POST /api/auth/register', () => {
    const registerPayload = {
      email: 'newdoctor@clinic.com',
      password: 'SecurePass123!',
      name: 'New Doctor',
      role: 'DOCTOR',
      phone: '0987654321',
    };

    it('should register a new user and return 201 with user + token', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null); // no duplicate

      const createdUser = {
        id: 2,
        email: registerPayload.email,
        name: registerPayload.name,
        role: registerPayload.role,
        phone: registerPayload.phone,
        createdAt: new Date(),
      };
      mockPrismaClient.user.create.mockResolvedValue(createdUser);

      const res = await request(app)
        .post('/api/auth/register')
        .send(registerPayload)
        .expect('Content-Type', /json/);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('user');
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.email).toBe(registerPayload.email);
      expect(res.body.user.name).toBe(registerPayload.name);
      expect(res.body.user.role).toBe(registerPayload.role);
      expect(typeof res.body.token).toBe('string');

      // Verify bcrypt was used to hash the password
      expect(mockPrismaClient.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: registerPayload.email,
            name: registerPayload.name,
            role: registerPayload.role,
          }),
        })
      );
      // The password passed to create should NOT be the plaintext
      const createCall = mockPrismaClient.user.create.mock.calls[0][0];
      expect(createCall.data.password).not.toBe(registerPayload.password);
    });

    it('should return 400 when email is already registered', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(validUser);

      const res = await request(app)
        .post('/api/auth/register')
        .send(registerPayload);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message', 'Email already registered.');
      expect(mockPrismaClient.user.create).not.toHaveBeenCalled();
    });

    it('should return 403 when trying to create a SUPERADMIN', async () => {
      // Ensure no duplicate exists so the test hits the SUPERADMIN check, not the duplicate check
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...registerPayload, role: 'SUPERADMIN' });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty(
        'message',
        'Cannot create SUPERADMIN accounts through registration.'
      );
      expect(mockPrismaClient.user.create).not.toHaveBeenCalled();
      // findUnique IS called now (to check for duplicates before the SUPERADMIN check)
      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledTimes(1);
    });

    it('should default role to DOCTOR when role is not provided', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);
      const { role, ...payloadWithoutRole } = registerPayload;
      mockPrismaClient.user.create.mockResolvedValue({ id: 3, ...payloadWithoutRole, role: 'DOCTOR' });

      const res = await request(app)
        .post('/api/auth/register')
        .send(payloadWithoutRole);

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('DOCTOR');
    });

    it('should return 500 when Prisma throws an error', async () => {
      mockPrismaClient.user.findUnique.mockRejectedValue(new Error('DB connection failed'));

      const res = await request(app)
        .post('/api/auth/register')
        .send(registerPayload);

      expect(res.status).toBe(500);
    });
  });

  // ─── POST /api/auth/login ──────────────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    it('should login successfully and return 200 with user + token', async () => {
      const loginUser = {
        ...validUser,
        password: bcrypt.hashSync('correct-pw-for-test', 10),
      };
      mockPrismaClient.user.findUnique.mockResolvedValue(loginUser);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: loginUser.email, password: 'correct-pw-for-test' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('user');
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.email).toBe(loginUser.email);
      expect(typeof res.body.token).toBe('string');

      // Verify the token decodes correctly
      const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
      expect(decoded.id).toBe(validUser.id);
      expect(decoded.email).toBe(validUser.email);
    });

    it('should return 401 for non-existent email', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'ghost@clinic.com', password: 'somepass123' });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('message', 'Invalid email or password.');
    });

    it('should return 401 for deactivated account', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue({
        ...validUser,
        isActive: false,
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: validUser.email, password: 'somepass123' });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('message', 'Account is deactivated.');
    });

    it('should return 401 for wrong password', async () => {
      const loginUser = {
        ...validUser,
        password: bcrypt.hashSync('real-pw-for-test', 10),
      };
      mockPrismaClient.user.findUnique.mockResolvedValue(loginUser);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: loginUser.email, password: 'wrong-pw-for-test' });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('message', 'Invalid email or password.');
    });
  });

  // ─── GET /api/auth/profile ─────────────────────────────────────────────────

  describe('GET /api/auth/profile', () => {
    it('should return the authenticated user profile', async () => {
      setupAuth();
      mockPrismaClient.user.findUnique.mockResolvedValueOnce(profileData);

      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('email', profileData.email);
      expect(res.body).toHaveProperty('name', profileData.name);
      expect(res.body).toHaveProperty('role', profileData.role);
      expect(res.body).toHaveProperty('isActive', true);
    });

    it('should return 401 without an authorization header', async () => {
      const res = await request(app).get('/api/auth/profile');

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('message', expect.any(String));
    });

    it('should return 401 with a malformed authorization header', async () => {
      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'InvalidToken');

      expect(res.status).toBe(401);
    });

    it('should return 401 with an expired token', async () => {
      const expiredToken = jwt.sign(
        { id: 1, email: 'admin@clinic.com', role: 'ADMIN' },
        process.env.JWT_SECRET,
        { expiresIn: '0s' }
      );
      // Wait a tick for expiry
      await new Promise((r) => setTimeout(r, 50));

      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
    });

    it('should return 404 when authenticated user is not found in DB', async () => {
      setupAuth();
      mockPrismaClient.user.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('message', 'User not found.');
    });

    it('should return the profile with doctor relations when user is a doctor', async () => {
      const doctorProfile = {
        ...profileData,
        role: 'DOCTOR',
        doctor: {
          id: 5,
          specialization: 'Cardiology',
          departments: [
            { id: 1, department: { id: 1, name: 'Cardiology Dept' } },
          ],
        },
      };
      setupAuth({ role: 'DOCTOR' });
      mockPrismaClient.user.findUnique.mockResolvedValueOnce(doctorProfile);

      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.doctor.specialization).toBe('Cardiology');
      expect(res.body.doctor.departments).toHaveLength(1);
    });
  });

  // ─── PUT /api/auth/profile ─────────────────────────────────────────────────

  describe('PUT /api/auth/profile', () => {
    it('should update and return the user profile', async () => {
      setupAuth();
      const updated = {
        id: 1,
        email: 'admin@clinic.com',
        name: 'Updated Name',
        role: 'ADMIN',
        phone: '5551112222',
      };
      mockPrismaClient.user.update.mockResolvedValue(updated);

      const res = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Name', phone: '5551112222' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Name');
      expect(res.body.phone).toBe('5551112222');
      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { name: 'Updated Name', phone: '5551112222' },
        select: { id: true, email: true, name: true, role: true, phone: true },
      });
    });

    it('should return 401 when not authenticated', async () => {
      const res = await request(app)
        .put('/api/auth/profile')
        .send({ name: 'Hacker' });

      expect(res.status).toBe(401);
    });
  });
});
