exports.getStats = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

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
      req.prisma.doctor.count(),
      req.prisma.patient.count(),
      req.prisma.appointment.count(),
      req.prisma.appointment.count({
        where: { dateTime: { gte: today, lt: tomorrow } },
      }),
      req.prisma.invoice.count({
        where: { status: { in: ['PENDING', 'PARTIALLY_PAID'] } },
      }),
      req.prisma.invoice.aggregate({
        _sum: { amount: true },
        where: { status: { in: ['PAID', 'PARTIALLY_PAID'] } },
      }),
      req.prisma.appointment.findMany({
        where: { dateTime: { gte: today, lt: tomorrow } },
        include: {
          doctor: { include: { user: { select: { name: true } } } },
          patient: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { dateTime: 'asc' },
        take: 10,
      }),
      req.prisma.appointment.findMany({
        where: { dateTime: { gte: tomorrow }, status: { in: ['SCHEDULED', 'CONFIRMED'] } },
        include: {
          doctor: { include: { user: { select: { name: true } } } },
          patient: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { dateTime: 'asc' },
        take: 10,
      }),
      req.prisma.appointment.groupBy({
        by: ['status'],
        _count: true,
      }),
    ]);

    res.json({
      totalDoctors,
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
