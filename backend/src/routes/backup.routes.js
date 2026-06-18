const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const DB_PATH = path.join(__dirname, '../../prisma/dev.db');

// Configure multer for restore upload
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const tmpDir = path.join(__dirname, '../../uploads/tmp');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      cb(null, tmpDir);
    },
    filename: (req, file, cb) => {
      cb(null, 'restore-' + Date.now() + '.db');
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/octet-stream' || file.originalname.endsWith('.db') || file.originalname.endsWith('.sqlite')) {
      cb(null, true);
    } else {
      cb(new Error('Only .db and .sqlite files are allowed.'));
    }
  },
});

/**
 * GET /api/backup/download
 * Download the SQLite database file.
 */
router.get('/download', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return res.status(404).json({ message: 'Database file not found.' });
    }
    const stats = fs.statSync(DB_PATH);
    const dateStr = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename=clinic-backup-${dateStr}.db`);
    res.setHeader('Content-Length', stats.size);
    fs.createReadStream(DB_PATH).pipe(res);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/backup/restore
 * Upload a SQLite database file to restore.
 */
router.post('/restore', authenticate, authorize('ADMIN'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    // Validate the uploaded file is a valid SQLite database
    const filePath = req.file.path;
    const header = fs.readFileSync(filePath, { encoding: 'utf8', length: 16 });
    if (!header.startsWith('SQLite format')) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ message: 'Invalid SQLite database file.' });
    }

    // Create a backup of current DB before restoring
    const backupPath = DB_PATH + '.bak';
    if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
    if (fs.existsSync(DB_PATH)) {
      fs.copyFileSync(DB_PATH, backupPath);
    }

    // Copy the new database file over the current one
    // Note: SQLite handles file-level locking; Prisma will reconnect on next query automatically
    fs.copyFileSync(filePath, DB_PATH);

    // Clean up temp file
    fs.unlinkSync(filePath);

    res.json({ message: 'Database restored successfully. A backup of your previous database was saved as dev.db.bak. A server restart is recommended to ensure all connections are refreshed.' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/backup/info
 * Get database info (size, last modified).
 */
router.get('/info', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return res.json({ exists: false });
    }
    const stats = fs.statSync(DB_PATH);
    res.json({
      exists: true,
      size: stats.size,
      sizeFormatted: stats.size < 1024 ? `${stats.size} B` :
        stats.size < 1024 * 1024 ? `${(stats.size / 1024).toFixed(1)} KB` :
        `${(stats.size / (1024 * 1024)).toFixed(1)} MB`,
      lastModified: stats.mtime.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
