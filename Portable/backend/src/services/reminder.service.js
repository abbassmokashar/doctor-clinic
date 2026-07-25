/**
 * Appointment Reminder Service
 *
 * Queries appointments and sends WhatsApp reminders to patients.
 * Message templates are stored in settings and can be customized by SUPERADMIN.
 * Supports both English and Arabic templates with placeholder replacement.
 *
 * The scheduler is started by calling startReminderScheduler(prisma).
 * It uses the WhatsApp service (whatsapp.service.js) for message delivery.
 */

const cron = require('node-cron');
const { sendMessage, getMode } = require('./whatsapp.service');

// ─── Configuration ────────────────────────────────────────────────────────────

const CRON_SCHEDULE = process.env.REMINDER_CRON_SCHEDULE || '0 9 * * *'; // 9:00 AM daily

// ─── Default Templates (used if settings are empty) ───────────────────────────

const DEFAULT_TEMPLATE_EN = [
  '🩺 *Appointment Reminder*',
  '',
  'Hi {patientName}!',
  '',
  'This is a friendly reminder that you have an appointment scheduled:',
  '',
  '📅 *Date:* {date}',
  '⏰ *Time:* {time}',
  '⏱ *Duration:* {duration} minutes',
  '👨‍⚕️ *Doctor:* Dr. {doctorName}',
  '{reasonLine}',
  '',
  'Please arrive 15 minutes early to complete any necessary paperwork.',
  '',
  'If you need to reschedule or cancel, please call the clinic.',
  '',
  'We look forward to seeing you! 😊',
].join('\n');

const DEFAULT_TEMPLATE_AR = [
  '🩺 *تذكير بالموعد*',
  '',
  'مرحباً {patientName}!',
  '',
  'هذا تذكير بموعدك القادم:',
  '',
  '📅 *التاريخ:* {date}',
  '⏰ *الوقت:* {time}',
  '⏱ *المدة:* {duration} دقيقة',
  '👨‍⚕️ *الطبيب:* د. {doctorName}',
  '{reasonLine}',
  '',
  'يرجى الحضور قبل الموعد بـ 15 دقيقة.',
  '',
  'إذا كنت بحاجة إلى إعادة جدولة أو إلغاء الموعد، يرجى الاتصال بالعيادة.',
  '',
  'نتطلع لرؤيتك! 😊',
].join('\n');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Load reminder-related settings from the database.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @returns {Promise<object>}
 */
async function loadReminderSettings(prisma) {
  const keys = [
    'reminderEnabled', 'reminderLanguage', 'reminderDaysBefore',
    'reminderMessageEn', 'reminderMessageAr', 'appName',
  ];
  const rows = await prisma.setting.findMany({
    where: { key: { in: keys } },
  });
  const map = {};
  rows.forEach((r) => { map[r.key] = r.value; });
  return {
    enabled: map.reminderEnabled !== 'false', // default true
    language: map.reminderLanguage || 'en',
    daysBefore: parseInt(map.reminderDaysBefore || '1', 10),
    templateEn: map.reminderMessageEn || DEFAULT_TEMPLATE_EN,
    templateAr: map.reminderMessageAr || DEFAULT_TEMPLATE_AR,
    clinicName: map.appName || 'Doctor Clinic',
  };
}

/**
 * Build a reminder message by replacing placeholders in the template.
 *
 * Available placeholders:
 *   {patientName}  – Patient's first name
 *   {date}         – Appointment date (formatted)
 *   {time}         – Appointment time (formatted)
 *   {duration}     – Duration in minutes
 *   {doctorName}   – Doctor's name
 *   {reason}       – Appointment reason (or empty)
 *   {reasonLine}   – Reason line (📋 Reason: ...) or empty
 *   {clinicName}   – Clinic name from settings
 *
 * @param {object} appointment - Full appointment object with patient & doctor
 * @param {object} settings - Reminder settings from loadReminderSettings()
 * @returns {string}
 */
function buildReminderMessage(appointment, settings) {
  const patient = appointment.patient;
  const doctor = appointment.doctor;
  const doctorName = doctor?.user?.name || 'your doctor';
  const dateTime = new Date(appointment.dateTime);
  const duration = appointment.duration || 30;

  const dateStr = dateTime.toLocaleDateString(settings.language === 'ar' ? 'ar-SA' : 'en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeStr = dateTime.toLocaleTimeString(settings.language === 'ar' ? 'ar-SA' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const reason = appointment.reason || '';
  const reasonLine = reason
    ? (settings.language === 'ar' ? `📋 *السبب:* ${reason}` : `📋 *Reason:* ${reason}`)
    : '';

  const template = settings.language === 'ar' ? settings.templateAr : settings.templateEn;

  return template
    .replace(/{patientName}/g, patient.firstName || 'there')
    .replace(/{date}/g, dateStr)
    .replace(/{time}/g, timeStr)
    .replace(/{duration}/g, String(duration))
    .replace(/{doctorName}/g, doctorName)
    .replace(/{reason}/g, reason)
    .replace(/{reasonLine}/g, reasonLine)
    .replace(/{clinicName}/g, settings.clinicName);
}

// ─── Core Logic ───────────────────────────────────────────────────────────────

/**
 * Query appointments for a target date and send reminders.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @returns {Promise<{ sent: number, failed: number, skipped: number, appointments: number }>}
 */
async function sendTomorrowReminders(prisma, { date = null } = {}) {
  const reminderSettings = await loadReminderSettings(prisma);

  if (!reminderSettings.enabled) {
    console.log('⏸️ [REMINDER] Reminders are disabled via settings. Skipping.');
    return { sent: 0, failed: 0, skipped: 0, appointments: 0 };
  }

  // Calculate target date range (default: daysBefore days from now)
  const now = new Date();
  const daysAhead = reminderSettings.daysBefore;
  const targetDate = date
    ? new Date(date)
    : new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const dayStart = new Date(targetDate);
  dayStart.setHours(0, 0, 0, 0);

  const dayEnd = new Date(dayStart);
  dayEnd.setHours(23, 59, 59, 999);

  console.log('');
  console.log('━'.repeat(60));
  console.log(`🔔 [REMINDER] Checking for appointments on ${dayStart.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);
  console.log(`   Language: ${reminderSettings.language === 'ar' ? 'Arabic (العربية)' : 'English'}`);
  console.log('━'.repeat(60));

  // Query appointments for the target date with SCHEDULED or CONFIRMED status
  const appointments = await prisma.appointment.findMany({
    where: {
      dateTime: {
        gte: dayStart,
        lte: dayEnd,
      },
      status: {
        in: ['SCHEDULED', 'CONFIRMED'],
      },
    },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
        },
      },
      doctor: {
        include: {
          user: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      dateTime: 'asc',
    },
  });

  if (appointments.length === 0) {
    console.log(`✅ [REMINDER] No appointments found for target date. Nothing to do.`);
    console.log('');
    return { sent: 0, failed: 0, skipped: 0, appointments: 0 };
  }

  console.log(`📊 [REMINDER] Found ${appointments.length} appointment(s) for target date`);
  console.log('');

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const appointment of appointments) {
    const patient = appointment.patient;
    const patientName = `${patient.firstName || ''} ${patient.lastName || ''}`.trim();
    const phone = patient.phone;

    if (!phone) {
      console.warn(`⚠️  [REMINDER] Patient #${patient.id} (${patientName || 'unknown'}) has no phone number. Skipping.`);
      skipped++;
      continue;
    }

    const message = buildReminderMessage(appointment, reminderSettings);

    console.log(`📬 [REMINDER] Sending reminder to ${patientName || phone} (${phone})...`);
    const result = await sendMessage(phone, message);

    if (result.success) {
      console.log(`✅ [REMINDER] Reminder sent successfully to ${patientName || phone}`);
      sent++;
    } else {
      console.error(`❌ [REMINDER] Failed to send reminder to ${patientName || phone}: ${result.error || 'Unknown error'}`);
      failed++;
    }
    console.log('');
  }

  console.log('━'.repeat(60));
  console.log(`📊 [REMINDER] Summary: ${sent} sent, ${skipped} skipped (no phone), ${failed} failed — out of ${appointments.length} appointment(s)`);
  console.log(`📱 [REMINDER] Mode: ${getMode()}`);
  console.log('━'.repeat(60));
  console.log('');

  return { sent, failed, skipped, appointments: appointments.length };
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

let schedulerTask = null;

/**
 * Start the daily reminder scheduler.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @returns {boolean} Whether the scheduler was started
 */
function startReminderScheduler(prisma) {
  if (schedulerTask) {
    console.log('[SCHEDULER] Reminder scheduler is already running.');
    return false;
  }

  if (!cron.validate(CRON_SCHEDULE)) {
    console.error(`[SCHEDULER] Invalid cron schedule: "${CRON_SCHEDULE}". Scheduler not started.`);
    return false;
  }

  console.log('');
  console.log('━'.repeat(60));
  console.log(`⏰ [SCHEDULER] Appointment Reminder Scheduler`);
  console.log(`   Cron schedule: ${CRON_SCHEDULE}`);
  console.log(`   Lookahead:     customizable via settings (default: next day)`);
  console.log(`   WhatsApp mode: ${getMode()}`);
  console.log('━'.repeat(60));
  console.log('');

  schedulerTask = cron.schedule(CRON_SCHEDULE, async () => {
    console.log(`[SCHEDULER] Cron trigger fired at ${new Date().toISOString()}`);
    try {
      await sendTomorrowReminders(prisma);
    } catch (error) {
      console.error('[SCHEDULER] Error running reminder job:', error);
    }
  });

  console.log(`[SCHEDULER] Reminder scheduler started. Will run on schedule: ${CRON_SCHEDULE}`);
  return true;
}

/**
 * Stop the reminder scheduler if running.
 */
function stopReminderScheduler() {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
    console.log('[SCHEDULER] Reminder scheduler stopped.');
  }
}

/**
 * Run a one-time check for appointments (useful for testing).
 * @param {import('@prisma/client').PrismaClient} prisma
 */
async function runOnce(prisma, options = {}) {
  console.log(`[REMINDER] Running one-time reminder check...`);
  return sendTomorrowReminders(prisma, options);
}

/**
 * Send a reminder for a single appointment by ID.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {number} appointmentId
 * @returns {Promise<{ success: boolean, message?: string, error?: string }>}
 */
async function sendSingleReminder(prisma, appointmentId) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      patient: {
        select: { id: true, firstName: true, lastName: true, phone: true },
      },
      doctor: {
        include: {
          user: { select: { name: true } },
        },
      },
    },
  });

  if (!appointment) {
    return { success: false, error: 'Appointment not found.' };
  }

  // Don't send reminders for past appointments
  if (new Date(appointment.dateTime) < new Date()) {
    return { success: false, error: 'Cannot send reminder for a past appointment.' };
  }

  const patient = appointment.patient;
  const patientName = `${patient.firstName || ''} ${patient.lastName || ''}`.trim();

  if (!patient.phone) {
    return { success: false, error: `Patient ${patientName || '# ' + patient.id} has no phone number.` };
  }

  const reminderSettings = await loadReminderSettings(prisma);
  const message = buildReminderMessage(appointment, reminderSettings);
  const result = await sendMessage(patient.phone, message);

  if (result.success) {
    console.log(`✅ [REMINDER] Single reminder sent to ${patientName || patient.phone}`);
    return { success: true, message: `Reminder sent to ${patientName || patient.phone}` };
  } else {
    console.error(`❌ [REMINDER] Failed to send single reminder to ${patientName || patient.phone}: ${result.error || 'Unknown error'}`);
    return { success: false, error: result.error || 'Failed to send WhatsApp message.' };
  }
}

/**
 * Get the current reminder settings (for the frontend settings page).
 * @param {import('@prisma/client').PrismaClient} prisma
 * @returns {Promise<object>}
 */
async function getReminderSettings(prisma) {
  return loadReminderSettings(prisma);
}

module.exports = {
  startReminderScheduler,
  stopReminderScheduler,
  sendTomorrowReminders,
  runOnce,
  buildReminderMessage,
  sendSingleReminder,
  getReminderSettings,
  DEFAULT_TEMPLATE_EN,
  DEFAULT_TEMPLATE_AR,
};
