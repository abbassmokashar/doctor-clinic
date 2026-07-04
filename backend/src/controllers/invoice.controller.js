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
        installments: {
          orderBy: { orderIndex: 'asc' },
        },
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
        installments: { orderBy: { orderIndex: 'asc' } },
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
    const { patientId, appointmentId, amount, description, dueDate, isInstallment, totalInstallments, installments } = req.body;

    const parsedAmount = parseFloat(amount);

    const invoice = await req.prisma.invoice.create({
      data: {
        patientId: parseInt(patientId),
        appointmentId: appointmentId ? parseInt(appointmentId) : null,
        amount: parsedAmount,
        description,
        dueDate: dueDate ? new Date(dueDate) : null,
        isInstallment: isInstallment || false,
        totalInstallments: totalInstallments ? parseInt(totalInstallments) : null,
      },
      include: {
        patient: { select: { firstName: true, lastName: true } },
      },
    });

    // Create installments if it's an installment plan
    if (isInstallment && installments && installments.length > 0) {
      await req.prisma.installment.createMany({
        data: installments.map((inst, idx) => ({
          invoiceId: invoice.id,
          amount: parseFloat(inst.amount),
          dueDate: new Date(inst.dueDate),
          orderIndex: idx + 1,
          notes: inst.notes || null,
        })),
      });
    } else if (isInstallment && totalInstallments) {
      // Auto-split into equal installments with monthly due dates
      const count = parseInt(totalInstallments);
      const splitAmount = parsedAmount / count;
      const baseDate = dueDate ? new Date(dueDate) : new Date();

      const installmentData = Array.from({ length: count }, (_, i) => {
        const instDate = new Date(baseDate);
        instDate.setMonth(instDate.getMonth() + i);
        return {
          invoiceId: invoice.id,
          amount: i === count - 1
            ? Math.round((parsedAmount - splitAmount * (count - 1)) * 100) / 100
            : Math.round(splitAmount * 100) / 100,
          dueDate: instDate,
          orderIndex: i + 1,
          notes: `Installment ${i + 1} of ${count}`,
        };
      });

      await req.prisma.installment.createMany({ data: installmentData });
    }

    // Fetch the invoice with installments
    const createdInvoice = await req.prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: {
        patient: { select: { firstName: true, lastName: true } },
        installments: { orderBy: { orderIndex: 'asc' } },
      },
    });

    res.status(201).json(createdInvoice);
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
