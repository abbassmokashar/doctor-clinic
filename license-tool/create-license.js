/**
 * License Creator
 * 
 * Creates a signed .lic file for a client.
 * 
 * Usage: node create-license.js
 * 
 * You'll be prompted for:
 *   1. Hardware ID (client reads this from their license page)
 *   2. Client name (e.g., "Joe's Clinic")
 *   3. Expiry (date or number of days from now)
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function parseExpiry(input) {
  // If it's a number, treat as days from now
  const num = parseInt(input, 10);
  if (!isNaN(num) && num > 0 && num < 36500) {
    const date = new Date();
    date.setDate(date.getDate() + num);
    return date.toISOString();
  }
  // Otherwise try parsing as a date
  const date = new Date(input);
  if (!isNaN(date.getTime())) {
    return date.toISOString();
  }
  throw new Error(
    `Invalid expiry: "${input}". Use a date (e.g., "2026-12-31") or number of days (e.g., "365").`
  );
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  License File Creator');
  console.log('═══════════════════════════════════════════');
  console.log('');

  // Check for private key
  const privateKeyPath = path.join(__dirname, 'private.pem');
  if (!fs.existsSync(privateKeyPath)) {
    console.error('ERROR: private.pem not found!');
    console.error('Run "node generate-keys.js" first to create key pair.');
    process.exit(1);
  }

  const hardwareId = await ask('Hardware ID (from client): ');
  if (!hardwareId) {
    console.error('ERROR: Hardware ID is required.');
    process.exit(1);
  }

  const clientName = await ask('Client name (e.g., "Joe\'s Clinic"): ');
  if (!clientName) {
    console.error('ERROR: Client name is required.');
    process.exit(1);
  }

  const expiryInput = await ask('Expiry (date like "2027-12-31" or days like "365"): ');
  let expiresAt;
  try {
    expiresAt = parseExpiry(expiryInput);
  } catch (err) {
    console.error(`ERROR: ${err.message}`);
    process.exit(1);
  }

  const issuedAt = new Date().toISOString();
  const licenseId = `LIC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  // Build license payload
  const licenseData = {
    id: licenseId,
    hardwareId,
    clientName,
    issuedAt,
    expiresAt,
  };

  // Sign with private key
  const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
  const signer = crypto.createSign('sha512');
  signer.update(JSON.stringify(licenseData));
  signer.end();
  const signature = signer.sign(privateKey, 'base64');

  // Create the license file
  const licenseFile = {
    ...licenseData,
    signature,
  };

  // Write output
  const outputPath = path.join(__dirname, `${licenseId}.lic`);
  fs.writeFileSync(outputPath, JSON.stringify(licenseFile, null, 2), 'utf8');

  console.log('');
  console.log('✓ License file created!');
  console.log(`  File: ${outputPath}`);
  console.log(`  ID:   ${licenseId}`);
  console.log(`  Client: ${clientName}`);
  console.log(`  Hardware ID: ${hardwareId}`);
  console.log(`  Expires: ${expiresAt}`);
  console.log('');
  console.log('Send this .lic file to the client.');
  console.log('They can upload it via the license activation page or drop it in their app folder.');

  rl.close();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
