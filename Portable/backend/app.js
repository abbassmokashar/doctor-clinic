require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { PrismaClient } = require('@prisma/client');

const authRoutes = require('./src/routes/auth.routes');
const doctorRoutes = require('./src/routes/doctor.routes');
const patientRoutes = require('./src/routes/patient.routes');
const appointmentRoutes = require('./src/routes/appointment.routes');
const scheduleRoutes = require('./src/routes/schedule.routes');
const medicalRecordRoutes = require('./src/routes/medicalRecord.routes');
const medicationRoutes = require('./src/routes/medication.routes');
const prescriptionRoutes = require('./src/routes/prescription.routes');
const departmentRoutes = require('./src/routes/department.routes');
const invoiceRoutes = require('./src/routes/invoice.routes');
const installmentRoutes = require('./src/routes/installment.routes');
const dashboardRoutes = require('./src/routes/dashboard.routes');
const medicalTestRoutes = require('./src/routes/medicalTest.routes');
const reminderRoutes = require('./src/routes/reminder.routes');
const settingRoutes = require('./src/routes/setting.routes');
const backupRoutes = require('./src/routes/backup.routes');
const whatsappRoutes = require('./src/routes/whatsapp.routes');
const { startReminderScheduler, stopReminderScheduler } = require('./src/services/reminder.service');

const { errorHandler, notFound } = require('./src/middleware/error.middleware');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// ─── Derive DB path from shared utility ─────────────────────────────────

const { getDbPath } = require('./src/utils/dbPath');

const DB_PATH = getDbPath();
console.log('[DB] Database path:', DB_PATH);
const BACKUPS_DIR = path.join(__dirname, 'uploads/backups');

// ─── Crash-Safe Database Setup + Startup ────────────────────────────────────

async function initializeDatabase() {
  try {
    await prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL');
  } catch (e) {
    console.warn('[DB] Could not set WAL mode (non-critical):', e.message);
  }
  try {
    await prisma.$queryRawUnsafe('PRAGMA synchronous=FULL');
  } catch (e) {
    console.warn('[DB] Could not set synchronous mode (non-critical):', e.message);
  }
  try {
    await prisma.$queryRawUnsafe('PRAGMA foreign_keys=ON');
  } catch (e) {
    console.warn('[DB] Could not set foreign_keys (non-critical):', e.message);
  }
  console.log('[DB] SQLite initialized');
}

async function createStartupBackup() {
  if (!fs.existsSync(DB_PATH)) return;
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
  try {
    const stats = fs.statSync(DB_PATH);
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `auto-startup-${dateStr}.db`;
    const filePath = path.join(BACKUPS_DIR, fileName);
    fs.copyFileSync(DB_PATH, filePath);
    await prisma.backup.create({
      data: { fileName, filePath, fileSize: stats.size },
    });
    console.log(`[BACKUP] Auto-backup created on startup: ${fileName}`);
  } catch (err) {
    console.warn('[BACKUP] Could not create startup backup:', err.message);
  }
}

async function createShutdownBackup() {
  if (!fs.existsSync(DB_PATH)) return;
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
  try {
    const stats = fs.statSync(DB_PATH);
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `auto-shutdown-${dateStr}.db`;
    const filePath = path.join(BACKUPS_DIR, fileName);
    fs.copyFileSync(DB_PATH, filePath);
    await prisma.backup.create({
      data: { fileName, filePath, fileSize: stats.size },
    });
    console.log(`[SHUTDOWN] Auto-backup created: ${fileName}`);
    return true;
  } catch (err) {
    console.warn('[SHUTDOWN] Could not create shutdown backup:', err.message);
    return false;
  }
}

// Simple file-only backup for crash scenarios (no Prisma — state may be corrupted)
function createEmergencyBackup() {
  if (!fs.existsSync(DB_PATH)) return;
  if (!fs.existsSync(BACKUPS_DIR)) {
    try { fs.mkdirSync(BACKUPS_DIR, { recursive: true }); } catch (e) {}
  }
  try {
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `auto-emergency-${dateStr}.db`;
    const filePath = path.join(BACKUPS_DIR, fileName);
    fs.copyFileSync(DB_PATH, filePath);
    console.log(`[CRASH] Emergency backup saved: ${fileName}`);
  } catch (err) {
    console.error('[CRASH] Could not create emergency backup:', err.message);
  }
}

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Make prisma accessible in request
app.use((req, res, next) => {
  req.prisma = prisma;
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/medical-records', medicalRecordRoutes);
app.use('/api/medications', medicationRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/installments', installmentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/medical-tests', medicalTestRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/whatsapp', whatsappRoutes);

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve built frontend in production
const frontendDist = path.join(__dirname, '../frontend/dist');
console.log('Frontend dist path:', frontendDist);
console.log('Frontend dist exists:', fs.existsSync(frontendDist));
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  // SPA catch-all - serve index.html for any route that isn't an API call
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Error handling
app.use(notFound);
app.use(errorHandler);

// ─── Server Start (awaited DB init) ──────────────────────────────────────────

if (process.env.NODE_ENV !== 'test') {
  (async () => {
    // 1. Initialize database (WAL mode + synchronous) before accepting requests
    await initializeDatabase();

    // 2. Create a startup backup
    await createStartupBackup();

    // 3. Start the reminder scheduler
    startReminderScheduler(prisma);

    // 4. Start listening
    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    // ─── Graceful Shutdown ──────────────────────────────────────────────────

    async function gracefulShutdown(signal) {
      console.log('');
      console.log('━'.repeat(60));
      console.log(`🛑 [SHUTDOWN] Received ${signal}. Starting graceful shutdown...`);

      // 1. Stop accepting new requests
      server.close(() => {
        console.log('[SHUTDOWN] HTTP server closed.');
      });

      // 2. Stop the reminder scheduler
      stopReminderScheduler();

      // 3. Create a safety backup
      await createShutdownBackup();

      // 4. Close the Prisma database connection
      try {
        await prisma.$disconnect();
        console.log('[SHUTDOWN] Database connection closed.');
      } catch (err) {
        console.warn('[SHUTDOWN] Error disconnecting database:', err.message);
      }

      console.log('[SHUTDOWN] Server shut down gracefully.');
      console.log('━'.repeat(60));
      process.exit(0);
    }

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

    // Crash handler: file-only backup, no Prisma (state may be corrupted)
    process.on('uncaughtException', (err) => {
      console.error('[CRASH] Uncaught exception:', err);
      createEmergencyBackup();
      stopReminderScheduler();
      process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
      console.error('[CRASH] Unhandled rejection:', reason);
    });
  })();
}

module.exports = app;
