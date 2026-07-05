const express = require('express');
const router = express.Router();
const { runOnce, sendSingleReminder, getReminderSettings, DEFAULT_TEMPLATE_EN, DEFAULT_TEMPLATE_AR } = require('../services/reminder.service');
const { authenticate, authorize } = require('../middleware/auth.middleware');

/**
 * POST /api/reminders/trigger
 *
 * Manually trigger appointment reminder checks.
 * Only accessible to ADMIN users.
 * Optionally accepts a `date` query param (YYYY-MM-DD) to check a specific date.
 */
router.post('/trigger', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { date } = req.query;
    const options = date ? { date: new Date(date) } : {};

    // Run in background (don't block the response)
    setImmediate(async () => {
      try {
        await runOnce(req.prisma, options);
      } catch (err) {
        console.error('[API] Background reminder job error:', err);
      }
    });

    const targetLabel = date
      ? new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : 'tomorrow';

    res.json({
      message: `Reminder check triggered for ${targetLabel}. Check server logs for results.`,
      triggeredAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/reminders/send/:appointmentId
 *
 * Send a WhatsApp reminder for a specific appointment.
 * Accessible to ADMIN, DOCTOR, and RECEPTIONIST roles.
 */
router.post('/send/:appointmentId', authenticate, authorize('ADMIN', 'DOCTOR', 'RECEPTIONIST'), async (req, res, next) => {
  try {
    const appointmentId = parseInt(req.params.appointmentId);
    console.log(`[API] Sending reminder for appointment #${appointmentId}...`);
    const result = await sendSingleReminder(req.prisma, appointmentId);

    if (result.success) {
      res.json(result);
    } else {
      console.error(`[API] Reminder failed for appointment #${appointmentId}:`, result);
      res.status(400).json(result);
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/reminders/settings
 *
 * Get current reminder settings including templates.
 * Only accessible to SUPERADMIN.
 */
router.get('/settings', authenticate, authorize('SUPERADMIN'), async (req, res, next) => {
  try {
    const settings = await getReminderSettings(req.prisma);
    res.json({
      enabled: settings.enabled,
      language: settings.language,
      daysBefore: settings.daysBefore,
      templateEn: settings.templateEn,
      templateAr: settings.templateAr,
      defaults: {
        templateEn: DEFAULT_TEMPLATE_EN,
        templateAr: DEFAULT_TEMPLATE_AR,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
