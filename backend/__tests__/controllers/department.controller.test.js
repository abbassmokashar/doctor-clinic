const departmentController = require('../../src/controllers/department.controller');
const { createMockReq, createMockRes, createMockNext } = require('../helpers/mock-prisma');

describe('Department Controller', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockRes = createMockRes();
    mockNext = createMockNext();
    jest.clearAllMocks();
  });

  const sampleDepartment = {
    id: 1,
    name: 'Cardiology',
    description: 'Heart and cardiovascular system',
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { doctors: 3 },
    doctors: [],
  };

  describe('getAll', () => {
    it('should return all departments with doctor counts', async () => {
      mockReq = createMockReq({
        user: { id: 1, role: 'ADMIN' },
      });
      mockReq.prisma.department.findMany.mockResolvedValue([sampleDepartment]);

      await departmentController.getAll(mockReq, mockRes, mockNext);

      expect(mockReq.prisma.department.findMany).toHaveBeenCalledWith({
        include: {
          _count: { select: { doctors: true } },
          doctors: { include: { doctor: { include: { user: { select: { name: true } } } } } },
        },
        orderBy: { name: 'asc' },
      });
      expect(mockRes.json).toHaveBeenCalledWith([sampleDepartment]);
    });
  });

  describe('getById', () => {
    it('should return department by id with doctors', async () => {
      const fullDept = {
        ...sampleDepartment,
        doctors: [{ doctor: { user: { name: 'Dr. Smith' } } }],
      };
      mockReq = createMockReq({
        user: { id: 1, role: 'ADMIN' },
        params: { id: '1' },
      });
      mockReq.prisma.department.findUnique.mockResolvedValue(fullDept);

      await departmentController.getById(mockReq, mockRes, mockNext);

      expect(mockReq.prisma.department.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: {
          doctors: {
            include: {
              doctor: {
                include: { user: { select: { id: true, email: true, name: true } } },
              },
            },
          },
        },
      });
      expect(mockRes.json).toHaveBeenCalledWith(fullDept);
    });

    it('should return 404 if department not found', async () => {
      mockReq = createMockReq({
        user: { id: 1, role: 'ADMIN' },
        params: { id: '999' },
      });
      mockReq.prisma.department.findUnique.mockResolvedValue(null);

      await departmentController.getById(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Department not found.' });
    });
  });

  describe('create', () => {
    it('should create a new department', async () => {
      mockReq = createMockReq({
        user: { id: 1, role: 'ADMIN' },
        body: { name: 'Neurology', description: 'Brain and nervous system' },
      });
      const created = { id: 2, name: 'Neurology', description: 'Brain and nervous system' };
      mockReq.prisma.department.create.mockResolvedValue(created);

      await departmentController.create(mockReq, mockRes, mockNext);

      expect(mockReq.prisma.department.create).toHaveBeenCalledWith({
        data: { name: 'Neurology', description: 'Brain and nervous system' },
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(created);
    });

    it('should return 400 if department name already exists', async () => {
      mockReq = createMockReq({
        user: { id: 1, role: 'ADMIN' },
        body: { name: 'Cardiology' },
      });
      const prismaError = new Error('Unique constraint failed');
      prismaError.code = 'P2002';
      mockReq.prisma.department.create.mockRejectedValue(prismaError);

      await departmentController.create(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Department with this name already exists.',
      });
    });
  });

  describe('update', () => {
    it('should update a department', async () => {
      mockReq = createMockReq({
        user: { id: 1, role: 'ADMIN' },
        params: { id: '1' },
        body: { name: 'Advanced Cardiology' },
      });
      const updated = { id: 1, name: 'Advanced Cardiology', description: 'Heart and cardiovascular system' };
      mockReq.prisma.department.update.mockResolvedValue(updated);

      await departmentController.update(mockReq, mockRes, mockNext);

      expect(mockReq.prisma.department.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { name: 'Advanced Cardiology', description: undefined },
      });
      expect(mockRes.json).toHaveBeenCalledWith(updated);
    });
  });

  describe('remove', () => {
    it('should delete a department', async () => {
      mockReq = createMockReq({
        user: { id: 1, role: 'ADMIN' },
        params: { id: '1' },
      });
      mockReq.prisma.department.delete.mockResolvedValue({ id: 1 });

      await departmentController.remove(mockReq, mockRes, mockNext);

      expect(mockReq.prisma.department.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Department deleted successfully.' });
    });
  });

  describe('addDoctor', () => {
    it('should add a doctor to a department', async () => {
      mockReq = createMockReq({
        user: { id: 1, role: 'ADMIN' },
        params: { id: '1' },
        body: { doctorId: '5' },
      });
      const relation = {
        doctorId: 5,
        departmentId: 1,
        doctor: { user: { name: 'Dr. Smith' } },
        department: { name: 'Cardiology' },
      };
      mockReq.prisma.doctorDepartment.create.mockResolvedValue(relation);

      await departmentController.addDoctor(mockReq, mockRes, mockNext);

      expect(mockReq.prisma.doctorDepartment.create).toHaveBeenCalledWith({
        data: { doctorId: 5, departmentId: 1 },
        include: {
          doctor: { include: { user: { select: { name: true } } } },
          department: true,
        },
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(relation);
    });

    it('should return 400 if doctor already in department', async () => {
      mockReq = createMockReq({
        user: { id: 1, role: 'ADMIN' },
        params: { id: '1' },
        body: { doctorId: '5' },
      });
      const prismaError = new Error('Unique constraint failed');
      prismaError.code = 'P2002';
      mockReq.prisma.doctorDepartment.create.mockRejectedValue(prismaError);

      await departmentController.addDoctor(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Doctor already in this department.' });
    });
  });

  describe('removeDoctor', () => {
    it('should remove a doctor from a department', async () => {
      mockReq = createMockReq({
        user: { id: 1, role: 'ADMIN' },
        params: { id: '1', doctorId: '5' },
      });
      mockReq.prisma.doctorDepartment.delete.mockResolvedValue({ doctorId: 5, departmentId: 1 });

      await departmentController.removeDoctor(mockReq, mockRes, mockNext);

      expect(mockReq.prisma.doctorDepartment.delete).toHaveBeenCalledWith({
        where: {
          doctorId_departmentId: { doctorId: 5, departmentId: 1 },
        },
      });
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Doctor removed from department.' });
    });
  });
});
