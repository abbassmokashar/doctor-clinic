exports.getAll = async (req, res, next) => {
  try {
    const { status, doctorId, patientId, date } = req.query;
    const where = {};
    if (status) where.status = status;
    if (doctorId) where.doctorId = parseInt(doctorId);
    if (patientId) where.patientId = parseInt(patientId);
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      where.dateTime = { gte: start, lte: end };
    }

    const appointments = await req.prisma.appointment.findMany({
      where,
      include: {
        doctor: { include: { user: { select: { name: true } } } },
        patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
      orderBy: { dateTime: 'asc' },
    });
    res.json(appointments);
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const appointment = await req.prisma.appointment.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        doctor: { include: { user: { select: { name: true, email: true } } } },
        patient: true,
        medicalRecord: { include: { prescriptions: true } },
        invoice: true,
      },
    });

    if (!appointment) return res.status(404).json({ message: 'Appointment not found.' });
    res.json(appointment);
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { doctorId, patientId, dateTime, duration, reason } = req.body;

    // Check for overlapping appointments
    const apptTime = new Date(dateTime);
    const newDuration = duration || 30;
    const endTime = new Date(apptTime.getTime() + newDuration * 60000);

    // Fetch all active appointments for this doctor and check overlaps in-memory
    const existingAppointments = await req.prisma.appointment.findMany({
      where: {
        doctorId: parseInt(doctorId),
        status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] },
      },
      select: { id: true, dateTime: true, duration: true },
    });

    const overlapping = existingAppointments.some((existing) => {
      const existingStart = new Date(existing.dateTime);
      const existingEnd = new Date(existingStart.getTime() + (existing.duration || 30) * 60000);
      // New appointment starts before existing ends AND new appointment ends after existing starts
      return apptTime < existingEnd && endTime > existingStart;
    });

    if (overlapping) {
      return res.status(409).json({ message: 'Doctor has an overlapping appointment.' });
    }

    const appointment = await req.prisma.appointment.create({
      data: {
        doctorId: parseInt(doctorId),
        patientId: parseInt(patientId),
        dateTime: apptTime,
        duration: duration || 30,
        reason,
      },
      include: {
        doctor: { include: { user: { select: { name: true } } } },
        patient: { select: { firstName: true, lastName: true } },
      },
    });

    res.status(201).json(appointment);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { dateTime, duration, status, reason, notes } = req.body;

    const appointment = await req.prisma.appointment.update({
      where: { id: parseInt(req.params.id) },
      data: {
        dateTime: dateTime ? new Date(dateTime) : undefined,
        duration, status, reason, notes,
      },
      include: {
        doctor: { include: { user: { select: { name: true } } } },
        patient: { select: { firstName: true, lastName: true } },
      },
    });

    res.json(appointment);
  } catch (error) {
    next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    await req.prisma.appointment.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.json({ message: 'Appointment deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

exports.getToday = async (req, res, next) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const appointments = await req.prisma.appointment.findMany({
      where: { dateTime: { gte: start, lte: end } },
      include: {
        doctor: { include: { user: { select: { name: true } } } },
        patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
      orderBy: { dateTime: 'asc' },
    });

    res.json(appointments);
  } catch (error) {
    next(error);
  }
};
