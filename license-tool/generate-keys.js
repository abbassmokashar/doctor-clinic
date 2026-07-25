/**
 * License Key Generator
 * 
 * Generates RSA-4096 key pair for signing license files.
 * private.pem — KEEP SECRET on your machine only
 * public.pem  — embed in license.js and include in Portable/backend/
 * 
 * Usage: node generate-keys.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 4096,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem',
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
  },
});

const outDir = __dirname;

// Write private key
fs.writeFileSync(path.join(outDir, 'private.pem'), privateKey, 'utf8');
console.log('✓ private.pem created — KEEP THIS SECRET, never distribute it');

// Write public key
fs.writeFileSync(path.join(outDir, 'public.pem'), publicKey, 'utf8');
console.log('✓ public.pem created — embed this in license.js');

// Also output as a single-line for easy embedding
const singleLine = publicKey.replace(/\n/g, '\\n');
console.log('\n--- Public key (single-line for embedding) ---');
console.log(singleLine);
console.log('--- End public key ---\n');

console.log('Key pair generated successfully!');
console.log('  private.pem — your signing key (keep secret)');
console.log('  public.pem  — for license verification (embed in license.js)');
