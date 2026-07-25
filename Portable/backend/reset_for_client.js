/**
 * Reset Database for New Client
 *
 * Wipes the existing SQLite database and recreates it with ONLY the essential
 * users (superadmin + admin) — NO demo data.
 *
 * Usage:
 *   node reset_for_client.js
 *
 * This script:
 *   1. Deletes the current dev.db database file
 *   2. Runs prisma db push to recreate the schema
 *   3. Seeds the minimal data (superadmin + admin only)
 *   4. Clears the "uploads/backups" directory
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const BACKEND_DIR = __dirname;
const DB_PATH = path.join(BACKEND_DIR, 'prisma', 'dev.db');
const BACKUPS_DIR = path.join(BACKEND_DIR, 'uploads', 'backups');
const SEED_SCRIPT = path.join(BACKEND_DIR, 'prisma', 'seed.minimal.js');

console.log('');
console.log('═'.repeat(60));
console.log('  Doctor Clinic — Reset for New Client');
console.log('═'.repeat(60));
console.log('');

// ── Step 1: Delete existing database ─────────────────────────────────────

console.log('[1/4] Deleting existing database...');
if (fs.existsSync(DB_PATH)) {
  // Remove the main db file
  fs.unlinkSync(DB_PATH);
  console.log('  ✓ Deleted:', DB_PATH);

  // Remove WAL and SHM files if they exist (SQLite journal files)
  const walPath = DB_PATH + '-wal';
  const shmPath = DB_PATH + '-shm';
  if (fs.existsSync(walPath)) { fs.unlinkSync(walPath); console.log('  ✓ Deleted:', walPath); }
  if (fs.existsSync(shmPath)) { fs.unlinkSync(shmPath); console.log('  ✓ Deleted:', shmPath); }

  // Remove any journal files
  const journalPath = DB_PATH + '-journal';
  if (fs.existsSync(journalPath)) { fs.unlinkSync(journalPath); console.log('  ✓ Deleted:', journalPath); }
} else {
  console.log('  - No existing database found. Proceeding fresh.');
}

// ── Step 2: Clear backup directory ───────────────────────────────────────

console.log('\n[2/4] Clearing backup files...');
if (fs.existsSync(BACKUPS_DIR)) {
  const files = fs.readdirSync(BACKUPS_DIR);
  for (const file of files) {
    const filePath = path.join(BACKUPS_DIR, file);
    fs.unlinkSync(filePath);
  }
  console.log(`  ✓ Cleared ${files.length} backup file(s).`);
} else {
  console.log('  - No backups directory found. Skipping.');
}

// ── Step 3: Recreate database schema ─────────────────────────────────────

console.log('\n[3/4] Creating database schema...');
try {
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    cwd: BACKEND_DIR,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: 'file:./dev.db' },
  });
  console.log('  ✓ Schema created successfully.');
} catch (err) {
  console.error('  ✗ Failed to create schema:', err.message);
  process.exit(1);
}

// ── Step 4: Seed minimal data ────────────────────────────────────────────

console.log('\n[4/4] Seeding essential users...');
try {
  execSync(`node "${SEED_SCRIPT}"`, {
    cwd: BACKEND_DIR,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: 'file:./dev.db' },
  });
  console.log('  ✓ Essential users created.');
} catch (err) {
  console.error('  ✗ Failed to seed data:', err.message);
  process.exit(1);
}

// ── Done ─────────────────────────────────────────────────────────────────

console.log('');
console.log('═'.repeat(60));
console.log('  ✅ Reset complete! The database is now clean.');
console.log('');
console.log('  Login Credentials:');
console.log('    Superadmin:  superadmin@clinic.com / superadmin123');
console.log('    Admin:       admin@clinic.com / admin123');
console.log('');
console.log('  No demo data has been created.');
console.log('═'.repeat(60));
console.log('');
