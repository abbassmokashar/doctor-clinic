exports.getByPatient = async (req, res, next) => {
  try {
    const records = await req.prisma.medicalRecord.findMany({
      where: { patientId: parseInt(req.params.patientId) },
      include: {
        doctor: { include: { user: { select: { name: true } } } },
        prescriptions: { include: { medication: true } },
        appointment: { select: { dateTime: true, reason: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(records);
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const record = await req.prisma.medicalRecord.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        doctor: { include: { user: { select: { name: true } } } },
        patient: true,
        prescriptions: { include: { medication: true } },
        appointment: true,
      },
    });

    if (!record) return res.status(404).json({ message: 'Medical record not found.' });
    res.json(record);
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { patientId, doctorId, appointmentId, diagnosis, symptoms, notes } = req.body;

    const record = await req.prisma.medicalRecord.create({
      data: {
        patientId: parseInt(patientId),
        doctorId: parseInt(doctorId),
        appointmentId: appointmentId ? parseInt(appointmentId) : null,
        diagnosis, symptoms, notes,
      },
      include: {
        doctor: { include: { user: { select: { name: true } } } },
        patient: { select: { firstName: true, lastName: true } },
      },
    });

    // If linked to an appointment, update its status
    if (appointmentId) {
      await req.prisma.appointment.update({
        where: { id: parseInt(appointmentId) },
        data: { status: 'COMPLETED' },
      });
    }

    res.status(201).json(record);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { diagnosis, symptoms, notes } = req.body;

    const record = await req.prisma.medicalRecord.update({
      where: { id: parseInt(req.params.id) },
      data: { diagnosis, symptoms, notes },
      include: {
        doctor: { include: { user: { select: { name: true } } } },
        patient: { select: { firstName: true, lastName: true } },
      },
    });

    res.json(record);
  } catch (error) {
    next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    await req.prisma.medicalRecord.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.json({ message: 'Medical record deleted successfully.' });
  } catch (error) {
    next(error);
  }
};
