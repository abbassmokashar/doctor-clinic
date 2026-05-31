const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoice.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.get('/', authenticate, invoiceController.getAll);
router.get('/:id', authenticate, invoiceController.getById);
router.post('/', authenticate, authorize('ADMIN', 'RECEPTIONIST'), invoiceController.create);
router.put('/:id', authenticate, authorize('ADMIN', 'RECEPTIONIST'), invoiceController.update);
router.delete('/:id', authenticate, authorize('ADMIN'), invoiceController.remove);
router.patch('/:id/pay', authenticate, authorize('ADMIN', 'RECEPTIONIST'), invoiceController.markPaid);

module.exports = router;
