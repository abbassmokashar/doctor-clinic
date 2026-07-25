const express = require('express');
const router = express.Router();
const installmentController = require('../controllers/installment.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.get('/invoice/:invoiceId', authenticate, authorize('ADMIN', 'RECEPTIONIST'), installmentController.getByInvoice);
router.patch('/:id/pay', authenticate, authorize('ADMIN', 'RECEPTIONIST'), installmentController.markPaid);

module.exports = router;
