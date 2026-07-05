const medicationController = require('../../src/controllers/medication.controller');
const { createMockReq, createMockRes, createMockNext } = require('../helpers/mock-prisma');

describe('Medication Controller', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockRes = createMockRes();
    mockNext = createMockNext();
    jest.clearAllMocks();
  });

  const sampleMedication = {
    id: 1,
    name: 'Amoxicillin',
    description: 'Antibiotic',
    manufacturer: 'PharmaCorp',
    sideEffects: 'Nausea, diarrhea',
    dosageForm: 'Capsule',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('getAll', () => {
    it('should return all medications ordered by name', async () => {
      mockReq = createMockReq({
        user: { id: 1, role: 'ADMIN' },
        query: {},
      });
      mockReq.prisma.medication.findMany.mockResolvedValue([sampleMedication]);

      await medicationController.getAll(mockReq, mockRes, mockNext);

      expect(mockReq.prisma.medication.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { name: 'asc' },
      });
      expect(mockRes.json).toHaveBeenCalledWith([sampleMedication]);
    });

    it('should search medications by name', async () => {
      mockReq = createMockReq({
        user: { id: 1, role: 'ADMIN' },
        query: { search: 'Amoxi' },
      });
      mockReq.prisma.medication.findMany.mockResolvedValue([sampleMedication]);

      await medicationController.getAll(mockReq, mockRes, mockNext);

      expect(mockReq.prisma.medication.findMany).toHaveBeenCalledWith({
        where: { name: { contains: 'Amoxi' } },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('getById', () => {
    it('should return medication by id with prescription count', async () => {
      mockReq = createMockReq({
        user: { id: 1, role: 'ADMIN' },
        params: { id: '1' },
      });
      const medicationWithCount = { ...sampleMedication, _count: { prescriptions: 5 } };
      mockReq.prisma.medication.findUnique.mockResolvedValue(medicationWithCount);

      await medicationController.getById(mockReq, mockRes, mockNext);

      expect(mockReq.prisma.medication.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: { _count: { select: { prescriptions: true } } },
      });
      expect(mockRes.json).toHaveBeenCalledWith(medicationWithCount);
    });

    it('should return 404 if medication not found', async () => {
      mockReq = createMockReq({
        user: { id: 1, role: 'ADMIN' },
        params: { id: '999' },
      });
      mockReq.prisma.medication.findUnique.mockResolvedValue(null);

      await medicationController.getById(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Medication not found.' });
    });
  });

  describe('create', () => {
    it('should create a new medication', async () => {
      mockReq = createMockReq({
        user: { id: 1, role: 'ADMIN' },
        body: {
          name: 'Ibuprofen',
          description: 'Pain reliever',
          manufacturer: 'HealthInc',
          sideEffects: 'Stomach upset',
          dosageForm: 'Tablet',
        },
      });
      const created = { id: 2, ...mockReq.body };
      mockReq.prisma.medication.create.mockResolvedValue(created);

      await medicationController.create(mockReq, mockRes, mockNext);

      expect(mockReq.prisma.medication.create).toHaveBeenCalledWith({
        data: {
          name: 'Ibuprofen',
          description: 'Pain reliever',
          manufacturer: 'HealthInc',
          sideEffects: 'Stomach upset',
          dosageForm: 'Tablet',
        },
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(created);
    });

    it('should return 400 if medication name already exists', async () => {
      mockReq = createMockReq({
        user: { id: 1, role: 'ADMIN' },
        body: { name: 'Amoxicillin' },
      });
      const prismaError = new Error('Unique constraint failed');
      prismaError.code = 'P2002';
      mockReq.prisma.medication.create.mockRejectedValue(prismaError);

      await medicationController.create(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Medication with this name already exists.',
      });
    });
  });

  describe('update', () => {
    it('should update a medication', async () => {
      mockReq = createMockReq({
        user: { id: 1, role: 'ADMIN' },
        params: { id: '1' },
        body: { description: 'Updated description' },
      });
      const updated = { ...sampleMedication, description: 'Updated description' };
      mockReq.prisma.medication.update.mockResolvedValue(updated);

      await medicationController.update(mockReq, mockRes, mockNext);

      expect(mockReq.prisma.medication.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          name: undefined,
          description: 'Updated description',
          manufacturer: undefined,
          sideEffects: undefined,
          dosageForm: undefined,
        },
      });
      expect(mockRes.json).toHaveBeenCalledWith(updated);
    });
  });

  describe('remove', () => {
    it('should delete a medication', async () => {
      mockReq = createMockReq({
        user: { id: 1, role: 'ADMIN' },
        params: { id: '1' },
      });
      mockReq.prisma.medication.delete.mockResolvedValue({ id: 1 });

      await medicationController.remove(mockReq, mockRes, mockNext);

      expect(mockReq.prisma.medication.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Medication deleted successfully.' });
    });
  });
});
