/**
 * Shared Database Path Utility
 *
 * Provides a single source of truth for resolving the SQLite database file path
 * from DATABASE_URL.  Resolves relative file: paths using the same anchor as
 * PrismaClient — the **schema file's directory** (prisma/) — so that
 * getDbPath() and Prisma always point to the same file.
 *
 * Usage:
 *   const { getDbPath } = require('./src/utils/dbPath');
 *   const dbPath = getDbPath();   // ← no argument needed
 */

const path = require('path');

// Anchor: dbPath.js lives at Portable/backend/src/utils/dbPath.js
// Project root = two levels up → Portable/backend/
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

// PrismaClient resolves relative file: paths from the schema file's directory.
// Schema is at Portable/backend/prisma/schema.prisma → schema dir = prisma/
const SCHEMA_DIR = path.join(PROJECT_ROOT, 'prisma');

/**
 * Resolve the absolute path to the SQLite database file.
 *
 * The DATABASE_URL environment variable is expected to be a `file:` URI
 * (e.g. "file:./dev.db").  Relative paths are resolved against the schema
 * directory, which is how PrismaClient resolves them at runtime.
 *
 * @returns {string} Absolute path to the database file.
 */
function getDbPath() {
  const url = process.env.DATABASE_URL || 'file:./dev.db';
  const match = url.match(/^file:(.+)$/);

  if (match) {
    const filePath = match[1];
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.resolve(SCHEMA_DIR, filePath);
  }

  // No "file:" prefix — fall back to sensible default
  return path.join(SCHEMA_DIR, 'dev.db');
}

module.exports = { getDbPath };
