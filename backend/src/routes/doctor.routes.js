const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctor.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.get('/', authenticate, doctorController.getAll);
router.get('/:id', authenticate, doctorController.getById);
router.post('/', authenticate, authorize('ADMIN'), doctorController.create);
router.put('/:id', authenticate, authorize('ADMIN', 'DOCTOR'), doctorController.update);
router.delete('/:id', authenticate, authorize('ADMIN'), doctorController.remove);
router.get('/:id/appointments', authenticate, doctorController.getAppointments);

module.exports = router;
