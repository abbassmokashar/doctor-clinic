/**
 * Minimal Database Seed — for fresh client installations
 *
 * Creates ONLY the essential users needed to log in and start using the app.
 * NO demo data (no sample doctors, patients, appointments, invoices, etc.).
 *
 * Run:   node prisma/seed.minimal.js
 * Or:    npx prisma db seed   (if package.json prisma.seed is changed to point here)
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding minimal data (no demo records)...');

  // ── Superadmin (cannot be created through the app) ─────────────────────
  const superadminPassword = await bcrypt.hash('superadmin123', 12);
  const superadmin = await prisma.user.upsert({
    where: { email: 'superadmin@clinic.com' },
    update: {},
    create: {
      email: 'superadmin@clinic.com',
      password: superadminPassword,
      name: 'Super Admin',
      role: 'SUPERADMIN',
      phone: '',
    },
  });
  console.log('  ✓ Superadmin:', superadmin.email);

  // ── Admin ──────────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@clinic.com' },
    update: {},
    create: {
      email: 'admin@clinic.com',
      password: adminPassword,
      name: 'Admin',
      role: 'ADMIN',
      phone: '',
    },
  });
  console.log('  ✓ Admin:', admin.email);

  console.log('\n✅ Seeding completed — no demo data created.');
  console.log('\nLogin Credentials:');
  console.log('  Superadmin:  superadmin@clinic.com / superadmin123');
  console.log('  Admin:       admin@clinic.com / admin123');
  console.log('\n💡 You can create doctors, patients, and other data from the UI.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
