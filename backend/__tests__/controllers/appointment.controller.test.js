const appointmentController = require('../../src/controllers/appointment.controller');
const { createMockReq, createMockRes, createMockNext } = require('../helpers/mock-prisma');

describe('Appointment Controller', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockRes = createMockRes();
    mockNext = createMockNext();
    jest.clearAllMocks();
  });

  const sampleAppointment = {
    id: 1,
    doctorId: 1,
    patientId: 1,
    dateTime: new Date('2026-07-10T10:00:00Z'),
    duration: 30,
    status: 'SCHEDULED',
    reason: 'Checkup',
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    doctor: { user: { name: 'Dr. Smith' } },
    patient: { firstName: 'John', lastName: 'Doe', phone: '123456789' },
  };

  describe('getAll', () => {
    it('should return all appointments for admin', async () => {
      mockReq = createMockReq({
        user: { id: 1, role: 'ADMIN' },
        query: {},
      });
      mockReq.prisma.appointment.findMany.mockResolvedValue([sampleAppointment]);

      await appointmentController.getAll(mockReq, mockRes, mockNext);

      expect(mockReq.prisma.appointment.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({}),
        include: {
          doctor: { include: { user: { select: { name: true } } } },
          patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
        },
        orderBy: { dateTime: 'asc' },
        take: 200,
      });
      expect(mockRes.json).toHaveBeenCalledWith([sampleAppointment]);
    });

    it('should filter by status and date', async () => {
      mockReq = createMockReq({
        user: { id: 1, role: 'ADMIN' },
        query: { status: 'SCHEDULED', date: '2026-07-10' },
      });
      mockReq.prisma.appointment.findMany.mockResolvedValue([sampleAppointment]);

      await appointmentController.getAll(mockReq, mockRes, mockNext);

      const callArgs = mockReq.prisma.appointment.findMany.mock.calls[0][0];
      expect(callArgs.where.status).toBe('SCHEDULED');
      expect(callArgs.where.dateTime).toBeDefined();
      expect(callArgs.where.dateTime.gte).toBeInstanceOf(Date);
      expect(callArgs.where.dateTime.lte).toBeInstanceOf(Date);
    });

    it('should filter by date range when start/end provided', async () => {
      mockReq = createMockReq({
        user: { id: 1, role: 'ADMIN' },
        query: { start: '2026-07-01T00:00:00Z', end: '2026-07-31T23:59:59Z' },
      });
      mockReq.prisma.appointment.findMany.mockResolvedValue([sampleAppointment]);

      await appointmentController.getAll(mockReq, mockRes, mockNext);

      expect(mockReq.prisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            dateTime: {
              gte: new Date('2026-07-01T00:00:00Z'),
              lte: new Date('2026-07-31T23:59:59Z'),
            },
          }),
        })
      );
    });

    it('should restrict doctors to their own appointments', async () => {
      mockReq = createMockReq({
        user: { id: 2, role: 'DOCTOR' },
        query: {},
      });
      mockReq.prisma.doctor.findUnique.mockResolvedValue({ id: 10, userId: 2 });
      mockReq.prisma.appointment.findMany.mockResolvedValue([sampleAppointment]);

      await appointmentController.getAll(mockReq, mockRes, mockNext);

      expect(mockReq.prisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ doctorId: 10 }),
        })
      );
    });

    it('should return empty array if doctor has no profile', async () => {
      mockReq = createMockReq({
        user: { id: 2, role: 'DOCTOR' },
        query: {},
      });
      mockReq.prisma.doctor.findUnique.mockResolvedValue(null);

      await appointmentController.getAll(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith([]);
    });
  });

  describe('getById', () => {
    it('should return appointment by id', async () => {
      const fullAppt = {
        ...sampleAppointment,
        medicalRecord: null,
        invoice: null,
      };
      mockReq = createMockReq({
        user: { id: 1, role: 'ADMIN' },
        params: { id: '1' },
      });
      mockReq.prisma.appointment.findUnique.mockResolvedValue(fullAppt);

      await appointmentController.getById(mockReq, mockRes, mockNext);

      expect(mockReq.prisma.appointment.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: {
          doctor: { include: { user: { select: { name: true, email: true } } } },
          patient: true,
          medicalRecord: { include: { prescriptions: true } },
          invoice: true,
        },
      });
      expect(mockRes.json).toHaveBeenCalledWith(fullAppt);
    });

    it('should return 404 if appointment not found', async () => {
      mockReq = createMockReq({
        user: { id: 1, role: 'ADMIN' },
        params: { id: '999' },
      });
      mockReq.prisma.appointment.findUnique.mockResolvedValue(null);

      await appointmentController.getById(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Appointment not found.' });
    });
  });

  describe('create', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const futureISO = futureDate.toISOString();

    beforeEach(() => {
      mockReq = createMockReq({
        user: { id: 1, role: 'ADMIN' },
        body: {
          doctorId: '1',
          patientId: '1',
          dateTime: futureISO,
          duration: 30,
          reason: 'Routine checkup',
        },
      });
    });

    it('should create an appointment successfully', async () => {
      mockReq.prisma.appointment.findMany
        .mockResolvedValueOnce([]) // doctor overlap check
        .mockResolvedValueOnce([]); // patient overlap check
      mockReq.prisma.appointment.create.mockResolvedValue(sampleAppointment);

      await appointmentController.create(mockReq, mockRes, mockNext);

      expect(mockReq.prisma.appointment.findMany).toHaveBeenCalledTimes(2);
      expect(mockReq.prisma.appointment.create).toHaveBeenCalledWith({
        data: {
          doctorId: 1,
          patientId: 1,
          dateTime: expect.any(Date),
          duration: 30,
          reason: 'Routine checkup',
        },
        include: {
          doctor: { include: { user: { select: { name: true } } } },
          patient: { select: { firstName: true, lastName: true } },
        },
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(sampleAppointment);
    });

    it('should return 409 if doctor has overlapping appointment', async () => {
      const existingAppt = {
        id: 5,
        dateTime: new Date(futureISO),
        duration: 30,
      };
      mockReq.prisma.appointment.findMany
        .mockResolvedValueOnce([existingAppt]); // doctor overlap

      await appointmentController.create(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Doctor has an overlapping appointment.' });
    });

    it('should return 409 if patient has overlapping appointment', async () => {
      mockReq.prisma.appointment.findMany
        .mockResolvedValueOnce([]) // doctor overlap - none
        .mockResolvedValueOnce([{ id: 6, dateTime: new Date(futureISO), duration: 30 }]); // patient overlap

      await appointmentController.create(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Patient already has an appointment at this time.' });
    });

    it('should return 400 if appointment is in the past', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      mockReq.body.dateTime = pastDate.toISOString();

      await appointmentController.create(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Cannot create an appointment in the past. Please select a future date and time.',
      });
    });

    it('should default duration to 30 if not provided', async () => {
      delete mockReq.body.duration;
      mockReq.prisma.appointment.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockReq.prisma.appointment.create.mockResolvedValue(sampleAppointment);

      await appointmentController.create(mockReq, mockRes, mockNext);

      expect(mockReq.prisma.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ duration: 30 }),
        })
      );
    });
  });

  describe('update', () => {
    it('should update an appointment', async () => {
      mockReq = createMockReq({
        user: { id: 1, role: 'ADMIN' },
        params: { id: '1' },
        body: { status: 'CONFIRMED', notes: 'Patient confirmed' },
      });
      mockReq.prisma.appointment.update.mockResolvedValue({
        ...sampleAppointment,
        status: 'CONFIRMED',
        notes: 'Patient confirmed',
      });

      await appointmentController.update(mockReq, mockRes, mockNext);

      expect(mockReq.prisma.appointment.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'CONFIRMED', notes: 'Patient confirmed' },
        include: {
          doctor: { include: { user: { select: { name: true } } } },
          patient: { select: { firstName: true, lastName: true } },
        },
      });
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'CONFIRMED', notes: 'Patient confirmed' })
      );
    });

    it('should check for doctor overlap when changing doctor', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      mockReq = createMockReq({
        user: { id: 1, role: 'ADMIN' },
        params: { id: '1' },
        body: { doctorId: '2' },
      });
      mockReq.prisma.appointment.findUnique.mockResolvedValue({
        id: 1,
        doctorId: 1,
        patientId: 1,
        dateTime: futureDate,
        duration: 30,
      });
      mockReq.prisma.appointment.findMany.mockResolvedValue([]); // no overlaps
      mockReq.prisma.appointment.update.mockResolvedValue(sampleAppointment);

      await appointmentController.update(mockReq, mockRes, mockNext);

      // Should have fetched current appointment to fill in missing fields
      expect(mockReq.prisma.appointment.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: { doctorId: true, dateTime: true, duration: true },
      });
    });

    it('should check for patient overlap when changing patient', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      mockReq = createMockReq({
        user: { id: 1, role: 'ADMIN' },
        params: { id: '1' },
        body: { patientId: '2' },
      });
      mockReq.prisma.appointment.findUnique
        .mockResolvedValueOnce({
          id: 1,
          doctorId: 1,
          patientId: 1,
          dateTime: futureDate,
          duration: 30,
        });
      mockReq.prisma.appointment.findMany
        .mockResolvedValueOnce([]) // doctor overlap check (skipped since doctorId not changing)
        .mockResolvedValueOnce([]); // patient overlap check

      // Need a second findUnique for the patient check
      // Actually, looking at the code: when patientId changes but doctorId doesn't change, 
      // the doctor overlap check is skipped (doctorId === undefined), but then it fetches the current appointment
      // for the patient check since effectivePatientId is new but effectiveDateTime would need fetching
      mockReq.prisma.appointment.findUnique
        .mockResolvedValueOnce({
          id: 1,
          doctorId: 1,
          patientId: 1,
          dateTime: futureDate,
          duration: 30,
        });
      mockReq.prisma.appointment.update.mockResolvedValue(sampleAppointment);

      await appointmentController.update(mockReq, mockRes, mockNext);

      expect(mockReq.prisma.appointment.update).toHaveBeenCalled();
    });

    it('should return 404 when updating non-existent appointment', async () => {
      mockReq = createMockReq({
        user: { id: 1, role: 'ADMIN' },
        params: { id: '999' },
        body: { doctorId: '1' }, // No dateTime provided so controller will fetch current appointment
      });
      mockReq.prisma.appointment.findUnique.mockResolvedValue(null);

      await appointmentController.update(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Appointment not found.' });
    });
  });

  describe('remove', () => {
    it('should delete an appointment', async () => {
      mockReq = createMockReq({
        user: { id: 1, role: 'ADMIN' },
        params: { id: '1' },
      });
      mockReq.prisma.appointment.delete.mockResolvedValue({ id: 1 });

      await appointmentController.remove(mockReq, mockRes, mockNext);

      expect(mockReq.prisma.appointment.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(mockRes.json).toHaveBeenCalledWith({ message: 'Appointment deleted successfully.' });
    });
  });

  describe('getToday', () => {
    it('should return today\'s appointments', async () => {
      mockReq = createMockReq({
        user: { id: 1, role: 'ADMIN' },
      });
      mockReq.prisma.appointment.findMany.mockResolvedValue([sampleAppointment]);

      await appointmentController.getToday(mockReq, mockRes, mockNext);

      expect(mockReq.prisma.appointment.findMany).toHaveBeenCalledWith({
        where: {
          dateTime: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
        },
        include: {
          doctor: { include: { user: { select: { name: true } } } },
          patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
        },
        orderBy: { dateTime: 'asc' },
      });
      expect(mockRes.json).toHaveBeenCalledWith([sampleAppointment]);
    });
  });
});
