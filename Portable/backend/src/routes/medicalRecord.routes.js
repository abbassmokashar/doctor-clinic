const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const medicalRecordController = require('../controllers/medicalRecord.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// Multer config for medical record image uploads
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/medical-record-images');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `record-image-${uniqueSuffix}${ext}`);
  },
});

const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF, WEBP, SVG) are allowed.'), false);
    }
  },
});

router.get('/patient/:patientId', authenticate, medicalRecordController.getByPatient);
router.get('/:id', authenticate, medicalRecordController.getById);
router.post('/', authenticate, authorize('ADMIN', 'DOCTOR', 'RECEPTIONIST'), medicalRecordController.create);
router.put('/:id', authenticate, authorize('ADMIN', 'DOCTOR', 'RECEPTIONIST'), medicalRecordController.update);
router.delete('/:id', authenticate, authorize('ADMIN'), medicalRecordController.remove);

// Image upload for a medical record
router.post('/:id/images', authenticate, authorize('ADMIN', 'DOCTOR', 'RECEPTIONIST'), imageUpload.single('image'), medicalRecordController.uploadImage);
router.delete('/:id/images/:imageIndex', authenticate, authorize('ADMIN', 'DOCTOR', 'RECEPTIONIST'), medicalRecordController.removeImage);

module.exports = router;
