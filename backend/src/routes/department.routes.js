const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/department.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.get('/', authenticate, departmentController.getAll);
router.get('/:id', authenticate, departmentController.getById);
router.post('/', authenticate, authorize('ADMIN'), departmentController.create);
router.put('/:id', authenticate, authorize('ADMIN'), departmentController.update);
router.delete('/:id', authenticate, authorize('ADMIN'), departmentController.remove);
router.post('/:id/doctors', authenticate, authorize('ADMIN'), departmentController.addDoctor);
router.delete('/:id/doctors/:doctorId', authenticate, authorize('ADMIN'), departmentController.removeDoctor);

module.exports = router;
