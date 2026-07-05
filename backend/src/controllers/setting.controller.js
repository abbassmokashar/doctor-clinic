const bcrypt = require('bcryptjs');

const REMINDER_KEYS = [
  'reminderEnabled', 'reminderLanguage', 'reminderDaysBefore',
  'reminderMessageEn', 'reminderMessageAr',
];

exports.getAll = async (req, res, next) => {
  try {
    const settings = await req.prisma.setting.findMany();
    const map = {};
    for (const s of settings) {
      // Hide reminder settings from non-SUPERADMIN users
      if (req.user.role !== 'SUPERADMIN' && REMINDER_KEYS.includes(s.key)) continue;
      map[s.key] = s.value;
    }
    res.json(map);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const updates = req.body; // { appName: "...", colorTheme: "...", logoUrl: "...", logoStyle: "..." }
    const allowedKeys = [
      'appName', 'appSubtitle', 'colorTheme', 'logoUrl', 'logoStyle', 'faviconUrl',
      'clinicSubtitle', 'invoiceClinicAddress', 'invoiceClinicPhone',
      'invoiceClinicEmail', 'invoiceTaxId', 'invoiceFooter',
      ...REMINDER_KEYS,
    ];

    for (const key of Object.keys(updates)) {
      if (!allowedKeys.includes(key)) continue;
      await req.prisma.setting.upsert({
        where: { key },
        update: { value: String(updates[key]) },
        create: { key, value: String(updates[key]) },
      });
    }

    // Return updated settings
    const settings = await req.prisma.setting.findMany();
    const map = {};
    settings.forEach((s) => { map[s.key] = s.value; });
    res.json(map);
  } catch (error) {
    next(error);
  }
};

// Logo upload
exports.uploadLogo = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    const logoUrl = `/uploads/logo/${req.file.filename}`;

    // Save logoUrl setting
    await req.prisma.setting.upsert({
      where: { key: 'logoUrl' },
      update: { value: logoUrl },
      create: { key: 'logoUrl', value: logoUrl },
    });

    // Also set logoStyle to 'image' when uploading
    await req.prisma.setting.upsert({
      where: { key: 'logoStyle' },
      update: { value: 'image' },
      create: { key: 'logoStyle', value: 'image' },
    });

    res.json({ logoUrl, logoStyle: 'image', message: 'Logo uploaded successfully.' });
  } catch (error) {
    next(error);
  }
};

// Favicon upload
exports.uploadFavicon = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    const faviconUrl = `/uploads/favicon/${req.file.filename}`;

    await req.prisma.setting.upsert({
      where: { key: 'faviconUrl' },
      update: { value: faviconUrl },
      create: { key: 'faviconUrl', value: faviconUrl },
    });

    res.json({ faviconUrl, message: 'Favicon uploaded successfully.' });
  } catch (error) {
    next(error);
  }
};

// Remove favicon (revert to default)
exports.removeFavicon = async (req, res, next) => {
  try {
    await req.prisma.setting.upsert({
      where: { key: 'faviconUrl' },
      update: { value: '' },
      create: { key: 'faviconUrl', value: '' },
    });

    res.json({ message: 'Favicon removed. Using default icon.' });
  } catch (error) {
    next(error);
  }
};

// Remove logo (revert to icon+text)
exports.removeLogo = async (req, res, next) => {
  try {
    await req.prisma.setting.upsert({
      where: { key: 'logoUrl' },
      update: { value: '' },
      create: { key: 'logoUrl', value: '' },
    });
    await req.prisma.setting.upsert({
      where: { key: 'logoStyle' },
      update: { value: 'icon' },
      create: { key: 'logoStyle', value: 'icon' },
    });

    res.json({ message: 'Logo removed. Using default icon.' });
  } catch (error) {
    next(error);
  }
};

// Users management (admin/superadmin only)
exports.getUsers = async (req, res, next) => {
  try {
    const where = {};
    // Hide SUPERADMIN users from non-SUPERADMIN requesters
    if (req.user.role !== 'SUPERADMIN') {
      where.role = { not: 'SUPERADMIN' };
    }

    const users = await req.prisma.user.findMany({
      where,
      select: {
        id: true, email: true, name: true, role: true, phone: true,
        isActive: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (error) {
    next(error);
  }
};

exports.createUser = async (req, res, next) => {
  try {
    const { name, email, password, role, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    // Prevent creating SUPERADMIN users
    if (role === 'SUPERADMIN') {
      return res.status(403).json({ message: 'Cannot create SUPERADMIN accounts.' });
    }

    // Check if email already exists
    const existingUser = await req.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await req.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: role || 'DOCTOR',
        phone: phone || null,
      },
      select: { id: true, email: true, name: true, role: true, phone: true, isActive: true, createdAt: true },
    });

    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    const { name, email, role, isActive, password } = req.body;

    // Prevent assigning SUPERADMIN role
    if (role === 'SUPERADMIN') {
      return res.status(403).json({ message: 'Cannot assign SUPERADMIN role.' });
    }

    // ADMIN cannot modify SUPERADMIN accounts (but SUPERADMIN can modify their own)
    const targetUser = await req.prisma.user.findUnique({ where: { id: userId } });
    if (targetUser && targetUser.role === 'SUPERADMIN' && req.user.role !== 'SUPERADMIN') {
      return res.status(403).json({ message: 'SUPERADMIN accounts cannot be modified.' });
    }

    // Prevent changing your own role
    if (role !== undefined && userId === req.user.id) {
      return res.status(403).json({ message: 'You cannot change your own role.' });
    }

    // Prevent deactivating yourself
    if (isActive !== undefined && userId === req.user.id && !isActive) {
      return res.status(403).json({ message: 'You cannot deactivate your own account.' });
    }

    const data = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (role !== undefined) data.role = role;
    if (isActive !== undefined) data.isActive = isActive;
    if (password) {
      data.password = await bcrypt.hash(password, 12);
    }

    const user = await req.prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, email: true, name: true, role: true, phone: true, isActive: true },
    });

    res.json(user);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Email already registered.' });
    }
    next(error);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);

    // Prevent deleting yourself
    if (userId === req.user.id) {
      return res.status(403).json({ message: 'You cannot delete your own account.' });
    }

    // ADMIN cannot delete SUPERADMIN accounts
    const targetUser = await req.prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found.' });
    }
    if (targetUser.role === 'SUPERADMIN' && req.user.role !== 'SUPERADMIN') {
      return res.status(403).json({ message: 'Cannot delete SUPERADMIN accounts.' });
    }

    await req.prisma.user.delete({ where: { id: userId } });

    res.json({ message: 'User deleted successfully.' });
  } catch (error) {
    next(error);
  }
};
