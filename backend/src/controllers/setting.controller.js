const bcrypt = require('bcryptjs');

exports.getAll = async (req, res, next) => {
  try {
    const settings = await req.prisma.setting.findMany();
    const map = {};
    settings.forEach((s) => { map[s.key] = s.value; });
    res.json(map);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const updates = req.body; // { appName: "...", colorTheme: "..." }
    const allowedKeys = ['appName', 'colorTheme'];

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

// Users management (admin only)
exports.getUsers = async (req, res, next) => {
  try {
    const users = await req.prisma.user.findMany({
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

exports.updateUser = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    const { name, email, role, isActive, password } = req.body;

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
