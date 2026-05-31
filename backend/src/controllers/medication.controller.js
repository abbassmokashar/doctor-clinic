exports.getAll = async (req, res, next) => {
  try {
    const { search } = req.query;
    const where = search
      ? { name: { contains: search, mode: 'insensitive' } }
      : {};

    const medications = await req.prisma.medication.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    res.json(medications);
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const medication = await req.prisma.medication.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { _count: { select: { prescriptions: true } } },
    });

    if (!medication) return res.status(404).json({ message: 'Medication not found.' });
    res.json(medication);
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { name, description, manufacturer, sideEffects, dosageForm } = req.body;

    const medication = await req.prisma.medication.create({
      data: { name, description, manufacturer, sideEffects, dosageForm },
    });

    res.status(201).json(medication);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Medication with this name already exists.' });
    }
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { name, description, manufacturer, sideEffects, dosageForm } = req.body;

    const medication = await req.prisma.medication.update({
      where: { id: parseInt(req.params.id) },
      data: { name, description, manufacturer, sideEffects, dosageForm },
    });

    res.json(medication);
  } catch (error) {
    next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    await req.prisma.medication.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.json({ message: 'Medication deleted successfully.' });
  } catch (error) {
    next(error);
  }
};
