const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patient.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.get('/', authenticate, patientController.getAll);
router.get('/:id', authenticate, patientController.getById);
router.post('/', authenticate, authorize('ADMIN', 'DOCTOR', 'RECEPTIONIST'), patientController.create);
router.put('/:id', authenticate, authorize('ADMIN', 'DOCTOR', 'RECEPTIONIST'), patientController.update);
router.delete('/:id', authenticate, authorize('ADMIN'), patientController.remove);

module.exports = router;
