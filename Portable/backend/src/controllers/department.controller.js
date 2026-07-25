exports.getAll = async (req, res, next) => {
  try {
    const departments = await req.prisma.department.findMany({
      include: {
        _count: { select: { doctors: true } },
        doctors: { include: { doctor: { include: { user: { select: { name: true } } } } } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(departments);
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const department = await req.prisma.department.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        doctors: {
          include: {
            doctor: {
              include: { user: { select: { id: true, email: true, name: true } } },
            },
          },
        },
      },
    });

    if (!department) return res.status(404).json({ message: 'Department not found.' });
    res.json(department);
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { name, description } = req.body;

    const department = await req.prisma.department.create({
      data: { name, description },
    });

    res.status(201).json(department);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Department with this name already exists.' });
    }
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { name, description } = req.body;

    const department = await req.prisma.department.update({
      where: { id: parseInt(req.params.id) },
      data: { name, description },
    });

    res.json(department);
  } catch (error) {
    next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    await req.prisma.department.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.json({ message: 'Department deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

exports.addDoctor = async (req, res, next) => {
  try {
    const { doctorId } = req.body;

    const relation = await req.prisma.doctorDepartment.create({
      data: {
        doctorId: parseInt(doctorId),
        departmentId: parseInt(req.params.id),
      },
      include: {
        doctor: { include: { user: { select: { name: true } } } },
        department: true,
      },
    });

    res.status(201).json(relation);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Doctor already in this department.' });
    }
    next(error);
  }
};

exports.removeDoctor = async (req, res, next) => {
  try {
    await req.prisma.doctorDepartment.delete({
      where: {
        doctorId_departmentId: {
          doctorId: parseInt(req.params.doctorId),
          departmentId: parseInt(req.params.id),
        },
      },
    });
    res.json({ message: 'Doctor removed from department.' });
  } catch (error) {
    next(error);
  }
};
