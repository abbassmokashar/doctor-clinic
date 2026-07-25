exports.getByInvoice = async (req, res, next) => {
  try {
    const installments = await req.prisma.installment.findMany({
      where: { invoiceId: parseInt(req.params.invoiceId) },
      orderBy: { orderIndex: 'asc' },
    });
    res.json(installments);
  } catch (error) {
    next(error);
  }
};

exports.markPaid = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    const installment = await req.prisma.installment.update({
      where: { id: parseInt(id) },
      data: {
        status: 'PAID',
        paidAmount: amount ? parseFloat(amount) : undefined,
        paidAt: new Date(),
      },
    });

    // Recalculate invoice paid amount and status
    const invoiceId = installment.invoiceId;
    const allInstallments = await req.prisma.installment.findMany({
      where: { invoiceId },
    });

    const totalPaid = allInstallments
      .filter((i) => i.status === 'PAID')
      .reduce((sum, i) => sum + (i.paidAmount ?? i.amount), 0);

    const allPaid = allInstallments.every((i) => i.status === 'PAID');
    const anyPaid = allInstallments.some((i) => i.status === 'PAID');

    await req.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        paidAmount: totalPaid,
        status: allPaid ? 'PAID' : anyPaid ? 'PARTIALLY_PAID' : 'PENDING',
        paidAt: allPaid ? new Date() : undefined,
      },
    });

    res.json(installment);
  } catch (error) {
    next(error);
  }
};
