exports.getAll = async (req, res, next) => {
  try {
    const { status, patientId } = req.query;
    const where = {};
    if (status) where.status = status;
    if (patientId) where.patientId = parseInt(patientId);

    const invoices = await req.prisma.invoice.findMany({
      where,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, phone: true } },
        appointment: { select: { dateTime: true, reason: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(invoices);
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const invoice = await req.prisma.invoice.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        patient: true,
        appointment: { include: { doctor: { include: { user: { select: { name: true } } } } } },
      },
    });

    if (!invoice) return res.status(404).json({ message: 'Invoice not found.' });
    res.json(invoice);
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { patientId, appointmentId, amount, description, dueDate } = req.body;

    const invoice = await req.prisma.invoice.create({
      data: {
        patientId: parseInt(patientId),
        appointmentId: appointmentId ? parseInt(appointmentId) : null,
        amount: parseFloat(amount),
        description,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      include: {
        patient: { select: { firstName: true, lastName: true } },
      },
    });

    res.status(201).json(invoice);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { amount, description, dueDate, status, paidAmount, paidAt } = req.body;

    const invoice = await req.prisma.invoice.update({
      where: { id: parseInt(req.params.id) },
      data: {
        amount: amount ? parseFloat(amount) : undefined,
        description,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        status,
        paidAmount: paidAmount ? parseFloat(paidAmount) : undefined,
        paidAt: paidAt ? new Date(paidAt) : undefined,
      },
      include: {
        patient: { select: { firstName: true, lastName: true } },
      },
    });

    res.json(invoice);
  } catch (error) {
    next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    await req.prisma.invoice.delete({
      where: { id: parseInt(req.params.id) },
    });
    res.json({ message: 'Invoice deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

exports.markPaid = async (req, res, next) => {
  try {
    const invoice = await req.prisma.invoice.update({
      where: { id: parseInt(req.params.id) },
      data: {
        status: 'PAID',
        paidAmount: req.body.amount || undefined,
        paidAt: new Date(),
      },
    });
    res.json(invoice);
  } catch (error) {
    next(error);
  }
};
