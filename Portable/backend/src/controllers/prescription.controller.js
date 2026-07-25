exports.getByMedicalRecord = async (req, res, next) => {
  try {
    const prescriptions = await req.prisma.prescription.findMany({
      where: { medicalRecordId: parseInt(req.params.medicalRecordId) },
      include: { medication: true, doctor: { include: { user: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(prescriptions);
  } catch (error) {
    next(error);
  }
};

exports.getByPatient = async (req, res, next) => {
  try {
    const prescriptions = await req.prisma.prescription.findMany({
      where: {
        medicalRecord: { patientId: parseInt(req.params.patientId) },
        isActive: true,
      },
      include: {
        medication: true,
        doctor: { include: { user: { select: { name: true } } } },
        medicalRecord: { select: { diagnosis: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(prescriptions);
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { medicalRecordId, medicationId, medicationName, dosage, frequency, duration, instructions, startDate, endDate } = req.body;

    // Get doctor from medical record or from request
    const medicalRecord = await req.prisma.medicalRecord.findUnique({
      where: { id: parseInt(medicalRecordId) },
    });

    if (!medicalRecord) {
      return res.status(404).json({ message: 'Medical record not found.' });
    }

    const prescription = await req.prisma.prescription.create({
      data: {
        medicalRecordId: parseInt(medicalRecordId),
        doctorId: medicalRecord.doctorId,
        medicationId: medicationId ? parseInt(medicationId) : null,
        medicationName,
        dosage, frequency, duration, instructions,
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
      },
      include: { medication: true, medicalRecord: { select: { diagnosis: true } } },
    });

    res.status(201).json(prescription);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { dosage, frequency, duration, instructions, isActive, endDate } = req.body;

    const prescription = await req.prisma.prescription.update({
      where: { id: parseInt(req.params.id) },
      data: { dosage, frequency, duration, instructions, isActive, endDate: endDate ? new Date(endDate) : undefined },
      include: { medication: true },
    });

    res.json(prescription);
  } catch (error) {
    next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    await req.prisma.prescription.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.json({ message: 'Prescription deleted successfully.' });
  } catch (error) {
    next(error);
  }
};
