const express = require('express');
const router = express.Router();
const prescriptionController = require('../controllers/prescription.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.get('/medical-record/:medicalRecordId', authenticate, prescriptionController.getByMedicalRecord);
router.get('/patient/:patientId', authenticate, prescriptionController.getByPatient);
router.post('/', authenticate, authorize('ADMIN', 'DOCTOR'), prescriptionController.create);
router.put('/:id', authenticate, authorize('ADMIN', 'DOCTOR'), prescriptionController.update);
router.delete('/:id', authenticate, authorize('ADMIN'), prescriptionController.remove);

module.exports = router;
