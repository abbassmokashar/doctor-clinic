exports.getAll = async (req, res, next) => {
  try {
    const doctors = await req.prisma.doctor.findMany({
      include: {
        user: { select: { id: true, email: true, name: true, phone: true } },
        departments: { include: { department: true } },
        schedules: { where: { isAvailable: true } },
        _count: { select: { appointments: true } },
      },
    });
    res.json(doctors);
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const doctor = await req.prisma.doctor.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        user: { select: { id: true, email: true, name: true, phone: true } },
        departments: { include: { department: true } },
        schedules: { orderBy: { dayOfWeek: 'asc' } },
        _count: { select: { appointments: true } },
      },
    });

    if (!doctor) return res.status(404).json({ message: 'Doctor not found.' });
    res.json(doctor);
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { userId, specialization, licenseNumber, bio, consultationFee } = req.body;

    // Verify user exists
    const user = await req.prisma.user.findUnique({
      where: { id: parseInt(userId) },
    });

    if (!user) {
      return res.status(400).json({ message: 'User not found.' });
    }

    const doctor = await req.prisma.doctor.create({
      data: {
        userId: parseInt(userId),
        specialization,
        licenseNumber,
        bio,
        consultationFee: consultationFee ? parseFloat(consultationFee) : null,
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });

    res.status(201).json(doctor);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { specialization, licenseNumber, bio, consultationFee, isAvailable } = req.body;

    const doctor = await req.prisma.doctor.update({
      where: { id: parseInt(req.params.id) },
      data: { specialization, licenseNumber, bio, consultationFee, isAvailable },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });

    res.json(doctor);
  } catch (error) {
    next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    await req.prisma.doctor.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.json({ message: 'Doctor deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

exports.getAppointments = async (req, res, next) => {
  try {
    const appointments = await req.prisma.appointment.findMany({
      where: { doctorId: parseInt(req.params.id) },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
      orderBy: { dateTime: 'desc' },
    });
    res.json(appointments);
  } catch (error) {
    next(error);
  }
};
