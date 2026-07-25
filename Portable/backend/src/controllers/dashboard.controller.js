exports.getStats = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let doctorWhere = {};
    let appointmentWhere = {};
    let patientWhere = {};
    let doctorId = null;

    // Doctors see only their own stats
    if (req.user.role === 'DOCTOR') {
      const doctor = await req.prisma.doctor.findUnique({ where: { userId: req.user.id } });
      if (doctor) {
        doctorId = doctor.id;
        doctorWhere = { id: doctor.id };
        appointmentWhere = { doctorId: doctor.id };
        // Get patients who have appointments with this doctor
        const treatedPatientIds = await req.prisma.appointment.findMany({
          where: { doctorId: doctor.id },
          select: { patientId: true },
          distinct: ['patientId'],
        });
        if (treatedPatientIds.length > 0) {
          patientWhere = { id: { in: treatedPatientIds.map((a) => a.patientId) } };
        }
      }
    }

    const [
      totalDoctors,
      totalPatients,
      totalAppointments,
      todayAppointments,
      pendingInvoices,
      totalRevenue,
      recentAppointments,
      upcomingAppointments,
      appointmentsByStatus,
    ] = await Promise.all([
      doctorId ? Promise.resolve(1) : req.prisma.doctor.count(),
      patientWhere.id ? req.prisma.patient.count({ where: patientWhere }) : req.prisma.patient.count(),
      req.prisma.appointment.count({ where: { ...appointmentWhere } }),
      req.prisma.appointment.count({
        where: { dateTime: { gte: today, lt: tomorrow }, ...appointmentWhere },
      }),
      req.prisma.invoice.count({
        where: { status: { in: ['PENDING', 'PARTIALLY_PAID'] }, ...(patientWhere.id ? { patientId: { in: patientWhere.id.in } } : {}) },
      }),
      req.prisma.invoice.aggregate({
        _sum: { amount: true },
        where: { status: { in: ['PAID', 'PARTIALLY_PAID'] }, ...(patientWhere.id ? { patientId: { in: patientWhere.id.in } } : {}) },
      }),
      req.prisma.appointment.findMany({
        where: { dateTime: { gte: today, lt: tomorrow }, ...appointmentWhere },
        include: {
          doctor: { include: { user: { select: { name: true } } } },
          patient: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { dateTime: 'asc' },
        take: 10,
      }),
      req.prisma.appointment.findMany({
        where: { dateTime: { gte: tomorrow }, status: { in: ['SCHEDULED', 'CONFIRMED'] }, ...appointmentWhere },
        include: {
          doctor: { include: { user: { select: { name: true } } } },
          patient: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { dateTime: 'asc' },
        take: 10,
      }),
      req.prisma.appointment.groupBy({
        by: ['status'],
        where: { ...appointmentWhere },
        _count: true,
      }),
    ]);

    res.json({
      totalDoctors: doctorId ? 1 : totalDoctors,
      totalPatients,
      totalAppointments,
      todayAppointments,
      pendingInvoices,
      totalRevenue: totalRevenue._sum.amount || 0,
      recentAppointments,
      upcomingAppointments,
      appointmentsByStatus: appointmentsByStatus.map((a) => ({
        status: a.status,
        count: a._count,
      })),
    });
  } catch (error) {
    next(error);
  }
};
