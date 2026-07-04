const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { authenticate, authorize } = require('../middleware/auth.middleware');

const DB_PATH = path.join(__dirname, '../../prisma/dev.db');
const BACKUPS_DIR = path.join(__dirname, '../../uploads/backups');

// Ensure backups directory exists
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

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

/**
 * GET /api/backup/list
 * List stored backups (up to 3 most recent).
 */
router.get('/list', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const backups = await req.prisma.backup.findMany({
      orderBy: { createdAt: 'desc' },
      take: 3,
    });

    // Attach file size from actual files and check existence
    const result = backups.map((b) => {
      const exists = fs.existsSync(b.filePath);
      let sizeFormatted = '-';
      if (exists) {
        const stats = fs.statSync(b.filePath);
        const size = stats.size;
        sizeFormatted = size < 1024 ? `${size} B` :
          size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` :
          `${(size / (1024 * 1024)).toFixed(1)} MB`;
      }
      return {
        id: b.id,
        fileName: b.fileName,
        fileSize: b.fileSize,
        sizeFormatted,
        createdAt: b.createdAt,
        exists,
      };
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/backup/create
 * Create a new backup of the current database.
 */
router.post('/create', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return res.status(404).json({ message: 'Database file not found.' });
    }

    const stats = fs.statSync(DB_PATH);
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `clinic-backup-${dateStr}.db`;
    const filePath = path.join(BACKUPS_DIR, fileName);

    // Copy the database file to backups directory
    fs.copyFileSync(DB_PATH, filePath);

    // Create a backup record
    const backup = await req.prisma.backup.create({
      data: {
        fileName,
        filePath,
        fileSize: stats.size,
      },
    });

    // Keep only the 3 most recent backups - delete older ones
    const allBackups = await req.prisma.backup.findMany({
      orderBy: { createdAt: 'desc' },
    });

    if (allBackups.length > 3) {
      const toDelete = allBackups.slice(3);
      for (const oldBackup of toDelete) {
        // Delete the file
        try {
          if (fs.existsSync(oldBackup.filePath)) {
            fs.unlinkSync(oldBackup.filePath);
          }
        } catch (e) {
          console.warn('Could not delete old backup file:', oldBackup.filePath);
        }
        // Delete the record
        await req.prisma.backup.delete({ where: { id: oldBackup.id } });
      }
    }

    res.status(201).json({
      id: backup.id,
      fileName: backup.fileName,
      fileSize: backup.fileSize,
      sizeFormatted: stats.size < 1024 ? `${stats.size} B` :
        stats.size < 1024 * 1024 ? `${(stats.size / 1024).toFixed(1)} KB` :
        `${(stats.size / (1024 * 1024)).toFixed(1)} MB`,
      createdAt: backup.createdAt,
      exists: true,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/backup/restore/:id
 * Restore the database from a stored backup.
 */
router.post('/restore/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const backupId = parseInt(req.params.id);
    const backup = await req.prisma.backup.findUnique({ where: { id: backupId } });

    if (!backup) {
      return res.status(404).json({ message: 'Backup not found.' });
    }

    if (!fs.existsSync(backup.filePath)) {
      return res.status(404).json({ message: 'Backup file not found on disk.' });
    }

    // Validate the backup file is a valid SQLite database
    const header = fs.readFileSync(backup.filePath, { encoding: 'utf8', length: 16 });
    if (!header.startsWith('SQLite format')) {
      return res.status(400).json({ message: 'Invalid backup file.' });
    }

    // Create a safety backup of current DB before restoring
    const safetyPath = DB_PATH + '.pre-restore.bak';
    if (fs.existsSync(safetyPath)) fs.unlinkSync(safetyPath);
    if (fs.existsSync(DB_PATH)) {
      fs.copyFileSync(DB_PATH, safetyPath);
    }

    // Copy the backup over the current database
    fs.copyFileSync(backup.filePath, DB_PATH);

    res.json({
      message: 'Database restored successfully from backup. A safety copy of the previous database was saved as dev.db.pre-restore.bak. A server restart is recommended.',
      restoredFrom: backup.fileName,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
