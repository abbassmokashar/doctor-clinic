require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { PrismaClient } = require('@prisma/client');

const authRoutes = require('./routes/auth.routes');
const doctorRoutes = require('./routes/doctor.routes');
const patientRoutes = require('./routes/patient.routes');
const appointmentRoutes = require('./routes/appointment.routes');
const scheduleRoutes = require('./routes/schedule.routes');
const medicalRecordRoutes = require('./routes/medicalRecord.routes');
const medicationRoutes = require('./routes/medication.routes');
const prescriptionRoutes = require('./routes/prescription.routes');
const departmentRoutes = require('./routes/department.routes');
const invoiceRoutes = require('./routes/invoice.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const reminderRoutes = require('./routes/reminder.routes');
const { startReminderScheduler } = require('./services/reminder.service');

const { errorHandler, notFound } = require('./middleware/error.middleware');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// Start the appointment reminder scheduler
startReminderScheduler(prisma);

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
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reminders', reminderRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve built frontend in production
const frontendDist = path.join(__dirname, '../../frontend/dist');
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
