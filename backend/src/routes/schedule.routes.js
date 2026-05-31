const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/schedule.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.get('/doctor/:doctorId', authenticate, scheduleController.getByDoctor);
router.put('/doctor/:doctorId', authenticate, authorize('ADMIN', 'DOCTOR'), scheduleController.upsert);
router.put('/:id', authenticate, authorize('ADMIN', 'DOCTOR'), scheduleController.update);
router.delete('/:id', authenticate, authorize('ADMIN'), scheduleController.remove);

module.exports = router;
