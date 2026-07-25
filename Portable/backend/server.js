/**
 * Doctor Clinic Portable — Server Entry Point with License Protection
 */

const path = require('path');
const fs = require('fs');
const express = require('express');
const license = require('./license');
// Prevent app.js from starting its own server (it listens when NODE_ENV !== 'test')
process.env.NODE_ENV = 'test';
const app = require('./app'); // Clean Express app (routes, middleware, etc.)

const PORT = process.env.PORT || 3000;

// ─── Create the outer server app ───────────────────────────────────────────

const server = express();

// ─── License API Routes (before middleware — no license check needed) ──────

// GET /api/license/status — returns current license info + hardware ID
server.get('/api/license/status', (req, res) => {
  const info = license.getLicenseInfo();
  res.json({
    ...info,
    hardwareId: license.getHardwareId(),
    activated: info.activated,
    valid: info.valid,
  });
});

// POST /api/license/activate — activate a license with .lic file content
server.post('/api/license/activate', express.json(), (req, res) => {
  const { license: licenseContent } = req.body;
  if (!licenseContent) {
    return res.status(400).json({ success: false, message: 'No license content provided.' });
  }
  const result = license.activateLicense(licenseContent);
  if (result.success) {
    return res.json(result);
  }
  return res.status(400).json(result);
});

// ─── License Check Middleware ──────────────────────────────────────────────

// Intercept all /api requests and check license validity
// (except /api/license/* which is handled above)
server.use('/api', (req, res, next) => {
  // Skip license check for license endpoints
  if (req.path.startsWith('/license/') || req.path === '/license') {
    return next();
  }

  const status = license.validateLicense();
  if (!status.valid) {
    return res.status(403).json({
      error: 'License required',
      message: status.message || 'License is not valid.',
      reason: status.reason,
      hardwareId: license.getHardwareId(),
      licenseInfo: status.licenseInfo || null,
    });
  }
  next();
});

// ─── Serve license activation page when not activated ──────────────────────

const publicDir = path.join(__dirname, 'public');

// If not activated, serve the license page for the root URL
server.use((req, res, next) => {
  const status = license.validateLicense();
  if (!status.valid && !req.path.startsWith('/api/')) {
    // Serve license.html for root or any non-API path
    const licenseHtml = path.join(publicDir, 'license.html');
    if (fs.existsSync(licenseHtml)) {
      return res.sendFile(licenseHtml);
    }
  }
  next();
});

// ─── Pass through to the full app (handles all routes, frontend, etc.) ────

server.use(app);

// ─── Start the server ──────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  const info = license.getLicenseInfo();
  if (info.activated && info.valid) {
    console.log(`[LICENSE] Activated for: ${info.clientName} | Expires: ${info.expiresAt}`);
  } else {
    console.log('[LICENSE] Not activated — license page will be shown.');
    console.log(`[LICENSE] Hardware ID: ${license.getHardwareId()}`);
  }
});
