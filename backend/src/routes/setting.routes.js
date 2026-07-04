const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const settingController = require('../controllers/setting.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// Multer config for logo uploads
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/logo');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `logo-${Date.now()}${ext}`);
  },
});

const logoUpload = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (PNG, JPG, GIF, SVG, WEBP) are allowed.'), false);
    }
  },
});

// Settings
router.get('/', authenticate, settingController.getAll);
router.put('/', authenticate, authorize('ADMIN'), settingController.update);
router.post('/logo', authenticate, authorize('ADMIN'), logoUpload.single('logo'), settingController.uploadLogo);
router.delete('/logo', authenticate, authorize('ADMIN'), settingController.removeLogo);

// Multer config for favicon uploads
const faviconStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/favicon');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `favicon-${Date.now()}${ext}`);
  },
});

const faviconUpload = multer({
  storage: faviconStorage,
  limits: { fileSize: 1 * 1024 * 1024 }, // 1MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (PNG, JPG, GIF, SVG, WEBP, ICO) are allowed.'), false);
    }
  },
});

router.post('/favicon', authenticate, authorize('ADMIN'), faviconUpload.single('favicon'), settingController.uploadFavicon);
router.delete('/favicon', authenticate, authorize('ADMIN'), settingController.removeFavicon);

// User management (admin/superadmin only)
router.get('/users', authenticate, authorize('ADMIN'), settingController.getUsers);
router.post('/users', authenticate, authorize('ADMIN'), settingController.createUser);
router.put('/users/:id', authenticate, authorize('ADMIN'), settingController.updateUser);
router.delete('/users/:id', authenticate, authorize('ADMIN'), settingController.deleteUser);

module.exports = router;
