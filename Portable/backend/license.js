/**
 * Doctor Clinic Portable — License Module
 * Handles license activation and verification using RSA-4096 + SHA-512 signatures.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── Paths ──────────────────────────────────────────────────────────────────

const PUBLIC_KEY_PATH = path.join(__dirname, 'public.pem');
const LICENSE_STORE_PATH = path.join(__dirname, 'data', 'license.json');

// ─── Helpers ────────────────────────────────────────────────────────────────

function ensureDataDir() {
  const dir = path.dirname(LICENSE_STORE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Generate a hardware ID unique to this machine.
 * Uses CPU model, total memory, hostname, and MAC addresses.
 */
function generateHardwareId() {
  const cpus = os.cpus();
  const cpuModel = cpus.length > 0 ? cpus[0].model : 'unknown';
  const totalMem = os.totalmem();
  const hostname = os.hostname();

  // Collect MAC addresses
  const ifaces = os.networkInterfaces();
  const macs = [];
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
        macs.push(iface.mac);
      }
    }
  }
  const macStr = macs.sort().join(',');

  // Create a hash from the combined system info
  const raw = `${cpuModel}|${totalMem}|${hostname}|${macStr}`;
  return crypto.createHash('sha256').update(raw).digest('hex').toUpperCase();
}

/**
 * Verify a license file's RSA signature using the public key.
 */
function verifyLicense(licenseData) {
  try {
    if (!fs.existsSync(PUBLIC_KEY_PATH)) {
      return { valid: false, reason: 'public_key_missing' };
    }

    const publicKey = fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');
    const { signature, ...payload } = licenseData;

    if (!signature) {
      return { valid: false, reason: 'no_signature' };
    }

    const verifier = crypto.createVerify('sha512');
    verifier.update(JSON.stringify(payload));
    verifier.end();

    const isValid = verifier.verify(publicKey, signature, 'base64');
    return { valid: isValid };
  } catch (err) {
    return { valid: false, reason: err.message };
  }
}

/**
 * Read stored license data from disk.
 */
function readStoredLicense() {
  try {
    if (!fs.existsSync(LICENSE_STORE_PATH)) return null;
    const raw = fs.readFileSync(LICENSE_STORE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Write license data to disk.
 */
function writeStoredLicense(data) {
  ensureDataDir();
  fs.writeFileSync(LICENSE_STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Get the current license info.
 * Returns: { activated, valid, hardwareId, expiresAt, clientName, message }
 */
function getLicenseInfo() {
  const hardwareId = getHardwareId();
  const stored = readStoredLicense();

  if (!stored) {
    return {
      activated: false,
      valid: false,
      hardwareId,
      message: 'No license activated.',
    };
  }

  // Check expiry
  const now = new Date();
  const expiresAt = new Date(stored.expiresAt);
  const expired = now > expiresAt;

  // Check hardware ID match
  const hwidMatch = stored.hardwareId === hardwareId;

  // Verify the stored license signature
  const verification = verifyLicense(stored);

  const valid = !expired && hwidMatch && verification.valid;

  return {
    activated: true,
    valid,
    hardwareId,
    expiresAt: stored.expiresAt,
    clientName: stored.clientName,
    licenseId: stored.id,
    reason: !valid
      ? expired
        ? 'License has expired.'
        : !hwidMatch
          ? 'Hardware ID mismatch — license is for a different machine.'
          : 'License signature is invalid.'
      : undefined,
    message: valid ? 'License is valid and active.' : 'License is not valid.',
  };
}

/**
 * Activate a license by parsing and verifying a .lic file's content.
 * @param {string} licenseContent - The raw text content of a .lic file
 * @returns {{ success: boolean, message: string }}
 */
function activateLicense(licenseContent) {
  try {
    let licenseData;
    try {
      licenseData = JSON.parse(licenseContent);
    } catch {
      return { success: false, message: 'Invalid license file format. Expected a JSON .lic file.' };
    }

    // Required fields
    if (!licenseData.id || !licenseData.hardwareId || !licenseData.expiresAt || !licenseData.signature) {
      return { success: false, message: 'Invalid license file — missing required fields (id, hardwareId, expiresAt, signature).' };
    }

    // Verify signature
    const verification = verifyLicense(licenseData);
    if (!verification.valid) {
      return {
        success: false,
        message: 'License signature verification failed. The file may be corrupted or not issued for this product.',
        reason: verification.reason,
      };
    }

    // Check expiry
    const now = new Date();
    const expiresAt = new Date(licenseData.expiresAt);
    if (now > expiresAt) {
      return { success: false, message: 'This license has already expired.' };
    }

    // Check hardware ID
    const hardwareId = getHardwareId();
    if (licenseData.hardwareId !== hardwareId) {
      return {
        success: false,
        message: 'This license was issued for a different machine. Hardware ID does not match.',
        expected: licenseData.hardwareId,
        actual: hardwareId,
      };
    }

    // All checks passed — store the license
    writeStoredLicense(licenseData);

    return {
      success: true,
      message: 'License activated successfully!',
      expiresAt: licenseData.expiresAt,
      clientName: licenseData.clientName,
    };
  } catch (err) {
    return { success: false, message: 'Error activating license: ' + err.message };
  }
}

/**
 * Get this machine's hardware ID.
 */
function getHardwareId() {
  // Hardware ID is deterministic from machine info
  return generateHardwareId();
}

/**
 * Validate the current license.
 * Used by middleware to check if API requests should be allowed.
 */
function validateLicense() {
  const info = getLicenseInfo();
  return {
    valid: info.activated && info.valid,
    message: info.message,
    reason: info.reason,
    licenseInfo: info.activated ? info : null,
  };
}

module.exports = {
  getLicenseInfo,
  activateLicense,
  getHardwareId,
  validateLicense,
};
