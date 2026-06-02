/**
 * Appointment Reminder Service
 *
 * Queries appointments scheduled for tomorrow and sends WhatsApp reminders
 * to patients. Runs on a configurable cron schedule.
 *
 * The scheduler is started by calling startReminderScheduler(prisma).
 * It uses the WhatsApp service (whatsapp.service.js) for message delivery.
 */

const cron = require('node-cron');
const { sendMessage, getMode } = require('./whatsapp.service');

// ─── Configuration ────────────────────────────────────────────────────────────

const CRON_SCHEDULE = process.env.REMINDER_CRON_SCHEDULE || '0 9 * * *'; // 9:00 AM daily

// ─── Message Templates ────────────────────────────────────────────────────────

/**
 * Build a friendly reminder message for a patient.
 */
function buildReminderMessage(appointment) {
  const patient = appointment.patient;
  const doctor = appointment.doctor;
  const doctorName = doctor?.user?.name || 'your doctor';
  const dateTime = new Date(appointment.dateTime);
  const dateStr = dateTime.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeStr = dateTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const duration = appointment.duration || 30;

  return [
    `🩺 *Appointment Reminder*`,
    ``,
    `Hi ${patient.firstName || 'there'}!`,
    ``,
    `This is a friendly reminder that you have an appointment scheduled:`,
    ``,
    `📅 *Date:* ${dateStr}`,
    `⏰ *Time:* ${timeStr}`,
    `⏱ *Duration:* ${duration} minutes`,
    `👨‍⚕️ *Doctor:* Dr. ${doctorName}`,
    appointment.reason ? `📋 *Reason:* ${appointment.reason}` : '',
    ``,
    `Please arrive 15 minutes early to complete any necessary paperwork.`,
    ``,
    `If you need to reschedule or cancel, please call the clinic.`,
    ``,
    `We look forward to seeing you! 😊`,
  ].filter(Boolean).join('\n');
}

// ─── Core Logic ───────────────────────────────────────────────────────────────

/**
 * Query appointments for tomorrow and send reminders.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @returns {Promise<{ sent: number, failed: number, appointments: number }>}
 */
async function sendTomorrowReminders(prisma, { date = null } = {}) {
  // Calculate tomorrow's date range
  const now = new Date();
  const targetDate = date ? new Date(date) : new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStart = new Date(targetDate);
  tomorrowStart.setHours(0, 0, 0, 0);

  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setHours(23, 59, 59, 999);

  console.log('');
  console.log('━'.repeat(60));
  console.log(`🔔 [REMINDER] Checking for appointments on ${tomorrowStart.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);
  console.log('━'.repeat(60));

  // Query appointments for tomorrow with SCHEDULED or CONFIRMED status
  const appointments = await prisma.appointment.findMany({
    where: {
      dateTime: {
        gte: tomorrowStart,
        lte: tomorrowEnd,
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
    console.log(`✅ [REMINDER] No appointments found for tomorrow. Nothing to do.`);
    console.log('');
    return { sent: 0, failed: 0, appointments: 0 };
  }

  console.log(`📊 [REMINDER] Found ${appointments.length} appointment(s) for tomorrow`);
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

    const message = buildReminderMessage(appointment);

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
  console.log(`   Lookahead:     next day's appointments`);
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
 * Run a one-time check for tomorrow's appointments (useful for testing).
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

  const message = buildReminderMessage(appointment);
  const result = await sendMessage(patient.phone, message);

  if (result.success) {
    console.log(`✅ [REMINDER] Single reminder sent to ${patientName || patient.phone}`);
    return { success: true, message: `Reminder sent to ${patientName || patient.phone}` };
  } else {
    console.error(`❌ [REMINDER] Failed to send single reminder to ${patientName || patient.phone}: ${result.error || 'Unknown error'}`);
    return { success: false, error: result.error || 'Failed to send WhatsApp message.' };
  }
}

module.exports = {
  startReminderScheduler,
  stopReminderScheduler,
  sendTomorrowReminders,
  runOnce,
  buildReminderMessage,
  sendSingleReminder,
};
