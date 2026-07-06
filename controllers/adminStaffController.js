const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

// Создание сотрудника
exports.createAdminStaff = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Имя, email и пароль обязательны' });
    }

    // Проверяем, что текущий пользователь - супер админ
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    // Проверяем, существует ли пользователь с таким email
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }

    // Создаем пользователя с ролью ADMIN_STAFF
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        name,
        phone,
        password: hashedPassword,
        role: 'ADMIN_STAFF'
      }
    });

    // Не создаем запись в Staff таблице, так как она для другой системы
    // Просто возвращаем данные пользователя
    res.status(201).json({
      success: true,
      message: 'Сотрудник успешно создан',
      staff: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating admin staff:', error);
    res.status(500).json({ error: 'Ошибка при создании сотрудника' });
  }
};

// Получение списка сотрудников админ панели
exports.getAdminStaffList = async (req, res) => {
  try {
    // Проверяем, что текущий пользователь - супер админ или сотрудник
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN_STAFF') {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const staff = await prisma.user.findMany({
      where: {
        role: 'ADMIN_STAFF'
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      staff
    });
  } catch (error) {
    console.error('Error getting admin staff list:', error);
    res.status(500).json({ error: 'Ошибка при получении списка сотрудников' });
  }
};

// Удаление сотрудника
exports.deleteAdminStaff = async (req, res) => {
  try {
    const { id } = req.params;

    // Проверяем, что текущий пользователь - супер админ
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    // Проверяем, существует ли сотрудник
    const staff = await prisma.user.findUnique({
      where: { id }
    });

    if (!staff || staff.role !== 'ADMIN_STAFF') {
      return res.status(404).json({ error: 'Сотрудник не найден' });
    }

    // Удаляем сотрудника
    await prisma.user.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Сотрудник успешно удален'
    });
  } catch (error) {
    console.error('Error deleting admin staff:', error);
    res.status(500).json({ error: 'Ошибка при удалении сотрудника' });
  }
};
