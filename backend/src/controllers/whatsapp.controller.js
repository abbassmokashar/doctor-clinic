/**
 * WhatsApp Controller
 *
 * Provides API endpoints to check the WhatsApp connection status,
 * retrieve the QR code (as a data URL), and disconnect/reconnect.
 */

const whatsappService = require('../services/whatsapp.service');

/**
 * GET /api/whatsapp/status
 *
 * Returns the current WhatsApp connection details:
 *  - status: 'connected' | 'qr_ready' | 'connecting' | 'disconnected' | 'auth_failure' | 'console_mode'
 *  - mode: 'web' | 'console'
 *  - qrDataUrl: base64 data URL of the QR code (null if not available)
 *  - deviceName: connected device name (null if not connected)
 *  - phoneNumber: connected phone number (null if not connected)
 *  - isConnected: boolean
 */
exports.getStatus = async (req, res, next) => {
  try {
    const details = whatsappService.getConnectionDetails();
    res.json(details);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/whatsapp/disconnect
 *
 * Forcefully disconnects the WhatsApp client, clears the session,
 * and starts a fresh connection (new QR code).
 * Only accessible to ADMIN users (authorization handled in routes).
 */
exports.disconnect = async (req, res, next) => {
  try {
    await whatsappService.resetConnection();
    res.json({
      message: 'WhatsApp client has been reset. A new QR code will be generated shortly.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};
