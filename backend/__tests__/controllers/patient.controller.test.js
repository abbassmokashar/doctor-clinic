const patientController = require('../../src/controllers/patient.controller');
const { createMockReq, createMockRes, createMockNext } = require('../helpers/mock-prisma');

describe('Patient Controller', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockRes = createMockRes();
    mockNext = createMockNext();
    jest.clearAllMocks();
  });

  const samplePatient = {
    id: 1,
    firstName: 'John',
    lastName: 'Doe',
    phone: '123456789',
    email: 'john@test.com',
    dateOfBirth: null,
    gender: 'Male',
    address: '123 Main St',
    bloodType: 'A+',
    allergies: 'None',
    emergencyContact: 'Jane Doe',
    emergencyPhone: '987654321',
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { appointments: 3, medicalRecords: 2, invoices: 1 },
  };

  describe('getAll', () => {
    it('should return all patients for admin', async () => {
      mockReq = createMockReq({
        user: { id: 1, role: 'ADMIN' },
        query: {},
      });
      mockReq.prisma.patient.findMany.mockResolvedValue([samplePatient]);

      await patientController.getAll(mockReq, mockRes, mockNext);

      expect(mockReq.prisma.patient.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({}),
        include: { _count: { select: { appointments: true, medicalRecords: true, invoices: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      expect(mockRes.json).toHaveBeenCalledWith([samplePatient]);
    });

    it('should filter by search query', async () => {
      mockReq = createMockReq({
        user: { id: 1, role: 'ADMIN' },
        query: { search: 'John' },
      });
      mockReq.prisma.patient.findMany.mockResolvedValue([samplePatient]);

      await patientController.getAll(mockReq, mockRes, mockNext);

      expect(mockReq.prisma.patient.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { firstName: { contains: 'John' } },
            { lastName: { contains: 'John' } },
            { phone: { contains: 'John' } },
            { email: { contains: 'John' } },
          ],
        },
        include: { _count: { select: { appointments: true, medicalRecords: true, invoices: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
    });

    it('should restrict doctors to their treated patients', async () => {
      mockReq = createMockReq({
        user: { id: 2, role: 'DOCTOR' },
        query: {},
      });
      mockReq.prisma.doctor.findUnique.mockResolvedValue({ id: 10, userId: 2 });
      mockReq.prisma.appointment.findMany.mockResolvedValue([
        { patientId: 1 },
        { patientId: 2 },
      ]);
      mockReq.prisma.patient.findMany.mockResolvedValue([samplePatient]);

      await patientController.getAll(mockReq, mockRes, mockNext);

      expect(mockReq.prisma.doctor.findUnique).toHaveBeenCalledWith({ where: { userId: 2 } });
      expect(mockReq.prisma.appointment.findMany).toHaveBeenCalledWith({
        where: { doctorId: 10 },
        select: { patientId: true },
        distinct: ['patientId'],
      });
      expect(mockReq.prisma.patient.findMany).toHaveBeenCalledWith({
        where: { id: { in: [1, 2] } },
        include: { _count: { select: { appointments: true, medicalRecords: true, invoices: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
    });

    it('should return empty array if doctor has no profile', async () => {
      mockReq = createMockReq({
        user: { id: 2, role: 'DOCTOR' },
        query: {},
      });
      mockReq.prisma.doctor.findUnique.mockResolvedValue(null);

      await patientController.getAll(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith([]);
    });
  });

  describe('getById', () => {
    it('should return patient by id with full details', async () => {
      const fullPatient = {
        ...samplePatient,
        user: { id: 3, email: 'john@test.com', name: 'John' },
        appointments: [],
        medicalRecords: [],
        invoices: [],
      };
      mockReq = createMockReq({
        user: { id: 1, role: 'ADMIN' },
        params: { id: '1' },
      });
      mockReq.prisma.patient.findUnique.mockResolvedValue(fullPatient);

      await patientController.getById(mockReq, mockRes, mockNext);

      expect(mockReq.prisma.patient.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: expect.objectContaining({
          user: { select: { id: true, email: true, name: true } },
        }),
      });
      expect(mockRes.json).toHaveBeenCalledWith(fullPatient);
    });

    it('should return 404 if patient not found', async () => {
      mockReq = createMockReq({
        user: { id: 1, role: 'ADMIN' },
        params: { id: '999' },
      });
      mockReq.prisma.patient.findUnique.mockResolvedValue(null);

      await patientController.getById(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Patient not found.' });
    });
  });

  describe('create', () => {
    it('should create a new patient', async () => {
      mockReq = createMockReq({
        user: { id: 1, role: 'ADMIN' },
        body: {
          firstName: 'Jane',
          lastName: 'Smith',
          phone: '5551234567',
          email: 'jane@test.com',
          gender: 'Female',
          dateOfBirth: '1990-01-15',
        },
      });
      mockReq.prisma.patient.create.mockResolvedValue({ id: 2, ...mockReq.body, dateOfBirth: new Date('1990-01-15') });

      await patientController.create(mockReq, mockRes, mockNext);

      expect(mockReq.prisma.patient.create).toHaveBeenCalledWith({
        data: {
          userId: undefined,
          firstName: 'Jane',
          lastName: 'Smith',
          dateOfBirth: new Date('1990-01-15'),
          gender: 'Female',
          phone: '5551234567',
          email: 'jane@test.com',
          address: undefined,
          bloodType: undefined,
          allergies: undefined,
          emergencyContact: undefined,
          emergencyPhone: undefined,
          notes: undefined,
        },
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });
  });

  describe('update', () => {
    it('should update a patient', async () => {
      mockReq = createMockReq({
        user: { id: 1, role: 'ADMIN' },
        params: { id: '1' },
        body: { firstName: 'Updated', phone: '9999999999' },
      });
      const updated = { id: 1, firstName: 'Updated', phone: '9999999999' };
      mockReq.prisma.patient.update.mockResolvedValue(updated);

      await patientController.update(mockReq, mockRes, mockNext);

      expect(mockReq.prisma.patient.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          firstName: 'Updated',
          lastName: undefined,
          dateOfBirth: null,
          gender: undefined,
          phone: '9999999999',
          email: undefined,
          address: undefined,
          bloodType: undefined,
          allergies: undefined,
          emergencyContact: undefined,
          emergencyPhone: undefined,
          notes: undefined,
        },
      });
      expect(mockRes.json).toHaveBeenCalledWith(updated);
    });

    it('should pass errors to next middleware', async () => {
      mockReq = createMockReq({
        user: { id: 1, role: 'ADMIN' },
        params: { id: '1' },
        body: { firstName: 'Updated' },
      });
      const error = new Error('Database error');
      mockReq.prisma.patient.update.mockRejectedValue(error);

      await patientController.update(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('remove', () => {
    it('should delete a patient', async () => {
      mockReq = createMockReq({
        user: { id: 1, role: 'ADMIN' },
        params: { id: '1' },
      });
      mockReq.prisma.patient.delete.mockResolvedValue({ id: 1 });

      await patientController.remove(mockReq, mockRes, mockNext);

      expect(mockReq.prisma.patient.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Patient deleted successfully.' });
    });
  });
});
