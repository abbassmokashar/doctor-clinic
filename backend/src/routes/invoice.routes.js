const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoice.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.get('/', authenticate, authorize('ADMIN', 'RECEPTIONIST'), invoiceController.getAll);
router.get('/:id', authenticate, authorize('ADMIN', 'RECEPTIONIST'), invoiceController.getById);
router.post('/', authenticate, authorize('ADMIN', 'RECEPTIONIST'), invoiceController.create);
router.put('/:id', authenticate, authorize('ADMIN', 'RECEPTIONIST'), invoiceController.update);
router.delete('/:id', authenticate, authorize('ADMIN'), invoiceController.remove);
router.patch('/:id/pay', authenticate, authorize('ADMIN', 'RECEPTIONIST'), invoiceController.markPaid);
router.post('/:id/send-whatsapp', authenticate, authorize('ADMIN', 'RECEPTIONIST'), invoiceController.sendWhatsApp);

module.exports = router;
