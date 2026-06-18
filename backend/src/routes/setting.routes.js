const express = require('express');
const router = express.Router();
const settingController = require('../controllers/setting.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// Settings
router.get('/', authenticate, settingController.getAll);
router.put('/', authenticate, authorize('ADMIN'), settingController.update);

// User management (admin only)
router.get('/users', authenticate, authorize('ADMIN'), settingController.getUsers);
router.put('/users/:id', authenticate, authorize('ADMIN'), settingController.updateUser);

module.exports = router;
