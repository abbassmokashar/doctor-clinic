const fs = require('fs');
const path = require('path');

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
    let { patientId, doctorId, appointmentId, diagnosis, symptoms, notes, images } = req.body;

    // If user is a doctor, auto-set to their doctor profile
    if (req.user.role === 'DOCTOR') {
      const doctor = await req.prisma.doctor.findUnique({ where: { userId: req.user.id } });
      if (!doctor) return res.status(400).json({ message: 'Doctor profile not found.' });
      doctorId = doctor.id;
    }

    const data = {
      patientId: parseInt(patientId),
      doctorId: parseInt(doctorId),
      appointmentId: appointmentId ? parseInt(appointmentId) : null,
      diagnosis, symptoms, notes,
    };

    if (images) {
      data.images = typeof images === 'string' ? images : JSON.stringify(images);
    }

    const record = await req.prisma.medicalRecord.create({
      data,
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
    const { diagnosis, symptoms, notes, images } = req.body;

    const data = { diagnosis, symptoms, notes };
    if (images) {
      data.images = typeof images === 'string' ? images : JSON.stringify(images);
    }

    const record = await req.prisma.medicalRecord.update({
      where: { id: parseInt(req.params.id) },
      data,
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
    const recordId = parseInt(req.params.id);

    // Delete associated image files before removing the record
    const record = await req.prisma.medicalRecord.findUnique({
      where: { id: recordId },
      select: { images: true },
    });

    if (record?.images) {
      try {
        const images = JSON.parse(record.images);
        if (Array.isArray(images)) {
          for (const img of images) {
            const filePath = path.join(__dirname, '../../', img.url);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          }
        }
      } catch (e) {
        // Ignore parse errors - just delete the record
      }
    }

    await req.prisma.medicalRecord.delete({
      where: { id: recordId },
    });
    res.json({ message: 'Medical record deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

exports.uploadImage = async (req, res, next) => {
  try {
    const recordId = parseInt(req.params.id);

    if (!req.file) {
      return res.status(400).json({ message: 'No image file uploaded.' });
    }

    const record = await req.prisma.medicalRecord.findUnique({
      where: { id: recordId },
      select: { images: true },
    });

    if (!record) {
      // Clean up the uploaded file if record not found
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: 'Medical record not found.' });
    }

    const imageUrl = `/uploads/medical-record-images/${req.file.filename}`;
    const newImage = {
      url: imageUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      type: req.file.mimetype,
      size: req.file.size,
    };

    let images = [];
    if (record.images) {
      try {
        images = JSON.parse(record.images);
        if (!Array.isArray(images)) images = [];
      } catch (e) {
        images = [];
      }
    }
    images.push(newImage);

    await req.prisma.medicalRecord.update({
      where: { id: recordId },
      data: { images: JSON.stringify(images) },
    });

    res.json({ image: newImage, images });
  } catch (error) {
    // Clean up the uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    next(error);
  }
};

exports.removeImage = async (req, res, next) => {
  try {
    const recordId = parseInt(req.params.id);
    const imageIndex = parseInt(req.params.imageIndex);

    const record = await req.prisma.medicalRecord.findUnique({
      where: { id: recordId },
      select: { images: true },
    });

    if (!record) return res.status(404).json({ message: 'Medical record not found.' });

    let images = [];
    if (record.images) {
      try {
        images = JSON.parse(record.images);
        if (!Array.isArray(images)) images = [];
      } catch (e) {
        images = [];
      }
    }

    if (imageIndex < 0 || imageIndex >= images.length) {
      return res.status(400).json({ message: 'Invalid image index.' });
    }

    const removed = images.splice(imageIndex, 1)[0];

    // Delete the file from disk
    if (removed?.url) {
      const filePath = path.join(__dirname, '../../', removed.url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await req.prisma.medicalRecord.update({
      where: { id: recordId },
      data: { images: images.length > 0 ? JSON.stringify(images) : null },
    });

    res.json({ images });
  } catch (error) {
    next(error);
  }
};
