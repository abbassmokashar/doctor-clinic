exports.getAll = async (req, res, next) => {
  try {
    const { status, doctorId, patientId, date, start, end, page, limit, sortBy, sortOrder } = req.query;
    const where = {};
    if (status) where.status = status;
    if (doctorId) where.doctorId = parseInt(doctorId);
    if (patientId) where.patientId = parseInt(patientId);
    if (date) {
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      where.dateTime = { gte: dayStart, lte: dayEnd };
    } else if (start && end) {
      where.dateTime = {
        gte: new Date(start),
        lte: new Date(end),
      };
    }

    // Doctors can only see their own appointments
    if (req.user.role === 'DOCTOR') {
      const doctor = await req.prisma.doctor.findUnique({ where: { userId: req.user.id } });
      if (doctor) {
        where.doctorId = doctor.id;
      } else {
        return res.json({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });
      }
    }

    // Pagination defaults
    const currentPage = Math.max(1, parseInt(page) || 1);
    const currentLimit = Math.min(200, Math.max(1, parseInt(limit) || 20));
    const skip = (currentPage - 1) * currentLimit;

    // Sorting
    const validSortFields = ['dateTime', 'status', 'duration', 'createdAt'];
    const field = validSortFields.includes(sortBy) ? sortBy : 'dateTime';
    const order = sortOrder === 'desc' ? 'desc' : 'asc';
    const orderBy = { [field]: order };

    const [appointments, total] = await Promise.all([
      req.prisma.appointment.findMany({
        where,
        include: {
          doctor: { include: { user: { select: { name: true } } } },
          patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
        },
        orderBy,
        skip,
        take: currentLimit,
      }),
      req.prisma.appointment.count({ where }),
    ]);

    res.json({
      data: appointments,
      total,
      page: currentPage,
      limit: currentLimit,
      totalPages: Math.ceil(total / currentLimit),
    });
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

    // Validate that the appointment time is in the future
    const apptTime = new Date(dateTime);
    const newDuration = duration || 30;
    const endTime = new Date(apptTime.getTime() + newDuration * 60000);

    if (endTime <= new Date()) {
      return res.status(400).json({ message: 'Cannot create an appointment in the past. Please select a future date and time.' });
    }

    // Check for overlapping appointments

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

    // Check that the patient doesn't already have an appointment at this time
    const patientAppointments = await req.prisma.appointment.findMany({
      where: {
        patientId: parseInt(patientId),
        status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] },
      },
      select: { id: true, dateTime: true, duration: true },
    });

    const patientOverlapping = patientAppointments.some((existing) => {
      const existingStart = new Date(existing.dateTime);
      const existingEnd = new Date(existingStart.getTime() + (existing.duration || 30) * 60000);
      return apptTime < existingEnd && endTime > existingStart;
    });

    if (patientOverlapping) {
      return res.status(409).json({ message: 'Patient already has an appointment at this time.' });
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
    const { doctorId, patientId, dateTime, duration, status, reason, notes } = req.body;
    const appointmentId = parseInt(req.params.id);

    const updateData = {};
    if (doctorId !== undefined) updateData.doctorId = parseInt(doctorId);
    if (patientId !== undefined) updateData.patientId = parseInt(patientId);
    if (dateTime !== undefined) updateData.dateTime = new Date(dateTime);
    if (duration !== undefined) updateData.duration = duration;
    if (status !== undefined) updateData.status = status;
    if (reason !== undefined) updateData.reason = reason;
    if (notes !== undefined) updateData.notes = notes;

    // If changing doctor or dateTime, check for overlaps (excluding self)
    if (doctorId !== undefined || dateTime !== undefined) {
      const targetDoctorId = doctorId !== undefined ? parseInt(doctorId) : undefined;
      const targetDateTime = dateTime !== undefined ? new Date(dateTime) : undefined;
      const targetDuration = duration !== undefined ? duration : undefined;

      // If doctor isn't changing, fetch the current appointment to get the doctorId
      let effectiveDoctorId = targetDoctorId;
      let effectiveDateTime = targetDateTime;
      let effectiveDuration = targetDuration;

      if (!effectiveDoctorId || !effectiveDateTime) {
        const current = await req.prisma.appointment.findUnique({
          where: { id: appointmentId },
          select: { doctorId: true, dateTime: true, duration: true },
        });
        if (!current) return res.status(404).json({ message: 'Appointment not found.' });
        effectiveDoctorId = effectiveDoctorId || current.doctorId;
        effectiveDateTime = effectiveDateTime || current.dateTime;
        effectiveDuration = effectiveDuration !== undefined ? effectiveDuration : current.duration || 30;
      }

      const apptTime = effectiveDateTime;
      const newDuration = effectiveDuration || 30;
      const endTime = new Date(apptTime.getTime() + newDuration * 60000);

      const existingAppointments = await req.prisma.appointment.findMany({
        where: {
          doctorId: effectiveDoctorId,
          id: { not: appointmentId }, // Exclude self
          status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] },
        },
        select: { id: true, dateTime: true, duration: true },
      });

      const overlapping = existingAppointments.some((existing) => {
        const existingStart = new Date(existing.dateTime);
        const existingEnd = new Date(existingStart.getTime() + (existing.duration || 30) * 60000);
        return apptTime < existingEnd && endTime > existingStart;
      });

      if (overlapping) {
        return res.status(409).json({ message: 'Doctor has an overlapping appointment.' });
      }
    }

    // If changing patient or dateTime, check for patient overlaps (excluding self)
    if (patientId !== undefined || dateTime !== undefined) {
      const targetPatientId = patientId !== undefined ? parseInt(patientId) : undefined;
      const targetDateTime = dateTime !== undefined ? new Date(dateTime) : undefined;
      const targetDuration = duration !== undefined ? duration : undefined;

      let effectivePatientId = targetPatientId;
      let effectiveDateTime = targetDateTime;
      let effectiveDuration = targetDuration;

      if (!effectivePatientId || !effectiveDateTime) {
        const current = await req.prisma.appointment.findUnique({
          where: { id: appointmentId },
          select: { patientId: true, dateTime: true, duration: true },
        });
        if (!current) return res.status(404).json({ message: 'Appointment not found.' });
        effectivePatientId = effectivePatientId || current.patientId;
        effectiveDateTime = effectiveDateTime || current.dateTime;
        effectiveDuration = effectiveDuration !== undefined ? effectiveDuration : current.duration || 30;
      }

      const apptTime = effectiveDateTime;
      const newDuration = effectiveDuration || 30;
      const endTime = new Date(apptTime.getTime() + newDuration * 60000);

      const existingAppointments = await req.prisma.appointment.findMany({
        where: {
          patientId: effectivePatientId,
          id: { not: appointmentId },
          status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] },
        },
        select: { id: true, dateTime: true, duration: true },
      });

      const patientOverlapping = existingAppointments.some((existing) => {
        const existingStart = new Date(existing.dateTime);
        const existingEnd = new Date(existingStart.getTime() + (existing.duration || 30) * 60000);
        return apptTime < existingEnd && endTime > existingStart;
      });

      if (patientOverlapping) {
        return res.status(409).json({ message: 'Patient already has an appointment at this time.' });
      }
    }

    const appointment = await req.prisma.appointment.update({
      where: { id: appointmentId },
      data: updateData,
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
