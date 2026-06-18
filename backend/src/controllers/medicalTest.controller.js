const path = require('path');
const fs = require('fs');

exports.upload = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    const { patientId, testType, notes } = req.body;

    // Find the doctor associated with the current user
    const doctor = await req.prisma.doctor.findUnique({ where: { userId: req.user.id } });
    if (!doctor) {
      // If file was uploaded, clean it up
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'Doctor profile not found.' });
    }

    const test = await req.prisma.medicalTest.create({
      data: {
        patientId: parseInt(patientId),
        doctorId: doctor.id,
        fileName: req.file.originalname,
        fileUrl: `/uploads/medical-tests/${req.file.filename}`,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        testType: testType || null,
        notes: notes || null,
      },
      include: {
        doctor: { include: { user: { select: { name: true } } } },
      },
    });

    res.status(201).json(test);
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }
    }
    next(error);
  }
};

exports.getByPatient = async (req, res, next) => {
  try {
    const tests = await req.prisma.medicalTest.findMany({
      where: { patientId: parseInt(req.params.patientId) },
      include: {
        doctor: { include: { user: { select: { name: true } } } },
      },
      orderBy: { uploadedAt: 'desc' },
    });
    res.json(tests);
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const test = await req.prisma.medicalTest.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        doctor: { include: { user: { select: { name: true } } } },
        patient: { select: { firstName: true, lastName: true } },
      },
    });

    if (!test) return res.status(404).json({ message: 'Medical test not found.' });
    res.json(test);
  } catch (error) {
    next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const test = await req.prisma.medicalTest.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!test) return res.status(404).json({ message: 'Medical test not found.' });

    // Delete the physical file
    const filePath = path.join(__dirname, '../../uploads/medical-tests', path.basename(test.fileUrl));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await req.prisma.medicalTest.delete({
      where: { id: parseInt(req.params.id) },
    });

    res.json({ message: 'Medical test deleted successfully.' });
  } catch (error) {
    next(error);
  }
};
