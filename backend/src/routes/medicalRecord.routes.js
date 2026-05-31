const express = require('express');
const router = express.Router();
const medicalRecordController = require('../controllers/medicalRecord.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.get('/patient/:patientId', authenticate, medicalRecordController.getByPatient);
router.get('/:id', authenticate, medicalRecordController.getById);
router.post('/', authenticate, authorize('ADMIN', 'DOCTOR'), medicalRecordController.create);
router.put('/:id', authenticate, authorize('ADMIN', 'DOCTOR'), medicalRecordController.update);
router.delete('/:id', authenticate, authorize('ADMIN'), medicalRecordController.remove);

module.exports = router;
