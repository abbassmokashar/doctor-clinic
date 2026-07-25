const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointment.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.get('/', authenticate, appointmentController.getAll);
router.get('/today', authenticate, appointmentController.getToday);
router.get('/:id', authenticate, appointmentController.getById);
router.post('/', authenticate, authorize('ADMIN', 'DOCTOR', 'RECEPTIONIST'), appointmentController.create);
router.post('/walk-in', authenticate, authorize('ADMIN', 'DOCTOR', 'RECEPTIONIST'), appointmentController.createWalkIn);
router.put('/:id', authenticate, authorize('ADMIN', 'DOCTOR', 'RECEPTIONIST'), appointmentController.update);
router.delete('/:id', authenticate, authorize('ADMIN'), appointmentController.remove);

module.exports = router;
