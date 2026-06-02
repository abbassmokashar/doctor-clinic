exports.getAll = async (req, res, next) => {
  try {
    const { search } = req.query;
    const where = search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    // Doctors can only see patients they have treated
    if (req.user.role === 'DOCTOR') {
      const doctor = await req.prisma.doctor.findUnique({ where: { userId: req.user.id } });
      if (doctor) {
        const treatedPatientIds = await req.prisma.appointment.findMany({
          where: { doctorId: doctor.id },
          select: { patientId: true },
          distinct: ['patientId'],
        });
        where.id = { in: treatedPatientIds.map((a) => a.patientId) };
      } else {
        return res.json([]);
      }
    }

    const patients = await req.prisma.patient.findMany({
      where,
      include: {
        _count: { select: { appointments: true, medicalRecords: true, invoices: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(patients);
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const patient = await req.prisma.patient.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        user: { select: { id: true, email: true, name: true } },
        appointments: {
          include: {
            doctor: { include: { user: { select: { name: true } } } },
          },
          orderBy: { dateTime: 'desc' },
          take: 20,
        },
        medicalRecords: {
          include: {
            doctor: { include: { user: { select: { name: true } } } },
            prescriptions: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        invoices: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!patient) return res.status(404).json({ message: 'Patient not found.' });
    res.json(patient);
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const {
      userId, firstName, lastName, dateOfBirth, gender, phone, email,
      address, bloodType, allergies, emergencyContact, emergencyPhone, notes,
    } = req.body;

    const patient = await req.prisma.patient.create({
      data: {
        userId, firstName, lastName, dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        gender, phone, email, address, bloodType, allergies,
        emergencyContact, emergencyPhone, notes,
      },
    });

    res.status(201).json(patient);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const {
      firstName, lastName, dateOfBirth, gender, phone, email,
      address, bloodType, allergies, emergencyContact, emergencyPhone, notes,
    } = req.body;

    const patient = await req.prisma.patient.update({
      where: { id: parseInt(req.params.id) },
      data: {
        firstName, lastName, dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        gender, phone, email, address, bloodType, allergies,
        emergencyContact, emergencyPhone, notes,
      },
    });

    res.json(patient);
  } catch (error) {
    next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    await req.prisma.patient.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.json({ message: 'Patient deleted successfully.' });
  } catch (error) {
    next(error);
  }
};
