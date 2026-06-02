const express = require('express');
const router = express.Router();
const medicationController = require('../controllers/medication.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.get('/', authenticate, medicationController.getAll);
router.get('/:id', authenticate, medicationController.getById);
router.post('/', authenticate, authorize('ADMIN'), medicationController.create);
router.put('/:id', authenticate, authorize('ADMIN'), medicationController.update);
router.delete('/:id', authenticate, authorize('ADMIN'), medicationController.remove);

module.exports = router;
