const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsapp.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

/**
 * GET /api/whatsapp/status
 *
 * Get the current WhatsApp connection status, QR code, and device info.
 * Accessible to ADMIN users.
 */
router.get('/status', authenticate, authorize('ADMIN'), whatsappController.getStatus);

/**
 * POST /api/whatsapp/disconnect
 *
 * Disconnect and reset the WhatsApp client, forcing a new QR code.
 * Only accessible to ADMIN users.
 */
router.post('/disconnect', authenticate, authorize('ADMIN'), whatsappController.disconnect);

module.exports = router;
