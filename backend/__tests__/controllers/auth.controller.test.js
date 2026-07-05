const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authController = require('../../src/controllers/auth.controller');
const { createMockReq, createMockRes, createMockNext } = require('../helpers/mock-prisma');

jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

describe('Auth Controller', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockRes = createMockRes();
    mockNext = createMockNext();
    jest.clearAllMocks();
  });

  describe('register', () => {
    beforeEach(() => {
      mockReq = createMockReq({
        body: {
          email: 'new@test.com',
          password: 'password123',
          name: 'New User',
          role: 'DOCTOR',
          phone: '123456789',
        },
      });
    });

    it('should register a new user successfully', async () => {
      const mockHashedPassword = 'hashed_password_123';
      const mockUser = {
        id: 2,
        email: 'new@test.com',
        name: 'New User',
        role: 'DOCTOR',
        phone: '123456789',
        createdAt: new Date(),
      };

      mockReq.prisma.user.findUnique.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue(mockHashedPassword);
      mockReq.prisma.user.create.mockResolvedValue(mockUser);
      jwt.sign.mockReturnValue('mock_token');

      await authController.register(mockReq, mockRes, mockNext);

      expect(mockReq.prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'new@test.com' },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12);
      expect(mockReq.prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'new@test.com',
          password: mockHashedPassword,
          name: 'New User',
          role: 'DOCTOR',
          phone: '123456789',
        },
        select: { id: true, email: true, name: true, role: true, phone: true, createdAt: true },
      });
      expect(jwt.sign).toHaveBeenCalledWith(
        { id: 2, email: 'new@test.com', role: 'DOCTOR' },
        'test-jwt-secret-key',
        { expiresIn: '1h' }
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({ user: mockUser, token: 'mock_token' });
    });

    it('should return 400 if email already exists', async () => {
      mockReq.prisma.user.findUnique.mockResolvedValue({ id: 1, email: 'new@test.com' });

      await authController.register(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Email already registered.' });
      expect(mockReq.prisma.user.create).not.toHaveBeenCalled();
    });

    it('should return 403 if trying to create SUPERADMIN', async () => {
      mockReq.body.role = 'SUPERADMIN';

      await authController.register(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Cannot create SUPERADMIN accounts through registration.',
      });
    });

    it('should default role to DOCTOR if not provided', async () => {
      delete mockReq.body.role;
      mockReq.prisma.user.findUnique.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue('hash');
      mockReq.prisma.user.create.mockResolvedValue({ id: 3 });
      jwt.sign.mockReturnValue('token');

      await authController.register(mockReq, mockRes, mockNext);

      expect(mockReq.prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: 'DOCTOR' }),
        })
      );
    });

    it('should pass errors to next middleware', async () => {
      const error = new Error('Database error');
      mockReq.prisma.user.findUnique.mockRejectedValue(error);

      await authController.register(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('login', () => {
    beforeEach(() => {
      mockReq = createMockReq({
        body: { email: 'user@test.com', password: 'password123' },
      });
    });

    it('should login successfully with valid credentials', async () => {
      const mockUser = {
        id: 1,
        email: 'user@test.com',
        password: 'hashed_password',
        name: 'Test User',
        role: 'DOCTOR',
        phone: '123456789',
        isActive: true,
      };

      mockReq.prisma.user.findUnique.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('mock_token');

      await authController.login(mockReq, mockRes, mockNext);

      expect(mockReq.prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'user@test.com' },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashed_password');
      expect(mockRes.json).toHaveBeenCalledWith({
        user: {
          id: 1,
          email: 'user@test.com',
          name: 'Test User',
          role: 'DOCTOR',
          phone: '123456789',
        },
        token: 'mock_token',
      });
    });

    it('should return 401 if user not found', async () => {
      mockReq.prisma.user.findUnique.mockResolvedValue(null);

      await authController.login(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Invalid email or password.' });
    });

    it('should return 401 if account is deactivated', async () => {
      mockReq.prisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'user@test.com',
        password: 'hash',
        isActive: false,
      });

      await authController.login(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Account is deactivated.' });
    });

    it('should return 401 if password is invalid', async () => {
      mockReq.prisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'user@test.com',
        password: 'hash',
        isActive: true,
      });
      bcrypt.compare.mockResolvedValue(false);

      await authController.login(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Invalid email or password.' });
    });
  });

  describe('getProfile', () => {
    beforeEach(() => {
      mockReq = createMockReq({
        user: { id: 1, email: 'user@test.com', role: 'DOCTOR' },
      });
    });

    it('should return user profile', async () => {
      const mockProfile = {
        id: 1,
        email: 'user@test.com',
        name: 'Test User',
        role: 'DOCTOR',
        phone: '123456789',
        isActive: true,
        createdAt: new Date(),
        doctor: { departments: [] },
        patient: null,
      };

      mockReq.prisma.user.findUnique.mockResolvedValue(mockProfile);

      await authController.getProfile(mockReq, mockRes, mockNext);

      expect(mockReq.prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          phone: true,
          isActive: true,
          createdAt: true,
          doctor: { include: { departments: { include: { department: true } } } },
          patient: true,
        },
      });
      expect(mockRes.json).toHaveBeenCalledWith(mockProfile);
    });

    it('should return 404 if user not found', async () => {
      mockReq.prisma.user.findUnique.mockResolvedValue(null);

      await authController.getProfile(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'User not found.' });
    });
  });

  describe('updateProfile', () => {
    beforeEach(() => {
      mockReq = createMockReq({
        user: { id: 1 },
        body: { name: 'Updated Name', phone: '987654321' },
      });
    });

    it('should update user profile successfully', async () => {
      const updatedUser = {
        id: 1,
        email: 'user@test.com',
        name: 'Updated Name',
        role: 'DOCTOR',
        phone: '987654321',
      };

      mockReq.prisma.user.update.mockResolvedValue(updatedUser);

      await authController.updateProfile(mockReq, mockRes, mockNext);

      expect(mockReq.prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { name: 'Updated Name', phone: '987654321' },
        select: { id: true, email: true, name: true, role: true, phone: true },
      });
      expect(mockRes.json).toHaveBeenCalledWith(updatedUser);
    });
  });
});
