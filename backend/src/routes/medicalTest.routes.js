const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const medicalTestController = require('../controllers/medicalTest.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/medical-tests'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `test-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    // Allow common medical document types
    const allowedTypes = [
      'application/pdf',
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'application/zip',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed. Allowed types: PDF, images, documents, spreadsheets, text, and zip files.`), false);
    }
  },
});

router.get('/patient/:patientId', authenticate, medicalTestController.getByPatient);
router.get('/:id', authenticate, medicalTestController.getById);
router.post('/upload', authenticate, authorize('ADMIN', 'DOCTOR'), upload.single('file'), medicalTestController.upload);
router.delete('/:id', authenticate, authorize('ADMIN', 'DOCTOR'), medicalTestController.remove);

module.exports = router;
