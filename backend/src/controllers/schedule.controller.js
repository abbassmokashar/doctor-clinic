exports.getByDoctor = async (req, res, next) => {
  try {
    const schedules = await req.prisma.doctorSchedule.findMany({
      where: { doctorId: parseInt(req.params.doctorId) },
      orderBy: { dayOfWeek: 'asc' },
    });
    res.json(schedules);
  } catch (error) {
    next(error);
  }
};

exports.upsert = async (req, res, next) => {
  try {
    const { schedules } = req.body;
    const doctorId = parseInt(req.params.doctorId);

    // Delete existing schedules for this doctor
    await req.prisma.doctorSchedule.deleteMany({
      where: { doctorId },
    });

    // Create new schedules
    const created = await req.prisma.doctorSchedule.createMany({
      data: schedules.map((s) => ({
        doctorId,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        isAvailable: s.isAvailable !== false,
      })),
    });

    const updated = await req.prisma.doctorSchedule.findMany({
      where: { doctorId },
      orderBy: { dayOfWeek: 'asc' },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { startTime, endTime, isAvailable } = req.body;

    const schedule = await req.prisma.doctorSchedule.update({
      where: { id: parseInt(req.params.id) },
      data: { startTime, endTime, isAvailable },
    });

    res.json(schedule);
  } catch (error) {
    next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    await req.prisma.doctorSchedule.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.json({ message: 'Schedule deleted successfully.' });
  } catch (error) {
    next(error);
  }
};
