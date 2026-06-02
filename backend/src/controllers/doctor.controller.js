const bcrypt = require('bcryptjs');

exports.getAll = async (req, res, next) => {
  try {
    const where = {};
    // Doctors can only see themselves
    if (req.user.role === 'DOCTOR') {
      const doctor = await req.prisma.doctor.findUnique({ where: { userId: req.user.id } });
      if (!doctor) return res.json([]);
      where.id = doctor.id;
    }

    const doctors = await req.prisma.doctor.findMany({
      where,
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
    const doctorId = parseInt(req.params.id);

    // Doctors can only view their own profile
    if (req.user.role === 'DOCTOR') {
      const myDoctor = await req.prisma.doctor.findUnique({ where: { userId: req.user.id } });
      if (!myDoctor || myDoctor.id !== doctorId) {
        return res.status(403).json({ message: 'You can only view your own profile.' });
      }
    }

    const doctor = await req.prisma.doctor.findUnique({
      where: { id: doctorId },
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
    const { name, email, password, specialization, licenseNumber, bio, consultationFee } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    // Check if email already exists
    const existingUser = await req.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered.' });
    }

    // Create user and doctor in a transaction
    const result = await req.prisma.$transaction(async (tx) => {
      const hashedPassword = await bcrypt.hash(password, 12);
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role: 'DOCTOR',
          phone: req.body.phone || null,
        },
      });

      const doctor = await tx.doctor.create({
        data: {
          userId: user.id,
          specialization,
          licenseNumber,
          bio,
          consultationFee: consultationFee ? parseFloat(consultationFee) : null,
        },
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      });

      return doctor;
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const doctorId = parseInt(req.params.id);
    const { specialization, licenseNumber, bio, consultationFee, isAvailable } = req.body;

    // Doctors can only update their own profile
    if (req.user.role === 'DOCTOR') {
      const myDoctor = await req.prisma.doctor.findUnique({ where: { userId: req.user.id } });
      if (!myDoctor || myDoctor.id !== doctorId) {
        return res.status(403).json({ message: 'You can only update your own profile.' });
      }
    }

    const doctor = await req.prisma.doctor.update({
      where: { id: doctorId },
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
    const doctorId = parseInt(req.params.id);

    // Doctors can only view their own appointments
    if (req.user.role === 'DOCTOR') {
      const doctor = await req.prisma.doctor.findUnique({ where: { userId: req.user.id } });
      if (!doctor || doctor.id !== doctorId) {
        return res.status(403).json({ message: 'You can only view your own appointments.' });
      }
    }

    const appointments = await req.prisma.appointment.findMany({
      where: { doctorId },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
      orderBy: { dateTime: 'desc' },
      take: 50,
    });
    res.json(appointments);
  } catch (error) {
    next(error);
  }
};
