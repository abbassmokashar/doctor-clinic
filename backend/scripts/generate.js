/**
 * Prisma Generate Retry Wrapper
 * 
 * On Windows, file-locking (OneDrive, antivirus) can cause `prisma generate`
 * to fail with EPERM when renaming the query engine DLL. This wrapper retries
 * the command with exponential backoff to handle transient locks.
 */

const { execSync } = require('child_process');
const path = require('path');

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('[prisma-generate] Generating Prisma Client...');

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      execSync('npx prisma generate', {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit',
        env: { ...process.env },
      });

      console.log('[prisma-generate] ✓ Prisma Client generated successfully.');
      return; // Success — exit
    } catch (err) {
      const isEperm =
        err.stderr?.includes('EPERM') ||
        err.stdout?.includes('EPERM') ||
        err.message?.includes('EPERM');

      if (isEperm && attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(
          `[prisma-generate] ⚠ File lock detected (attempt ${attempt}/${MAX_RETRIES}). ` +
            `Retrying in ${delay / 1000}s...`
        );
        await sleep(delay);
        continue;
      }

      // If it's not an EPERM error or we've exhausted retries, fail
      if (attempt === MAX_RETRIES) {
        console.error('[prisma-generate] ✗ Failed after', MAX_RETRIES, 'attempts.');
      }
      process.exit(1);
    }
  }
}

run();
