const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

// Создание сотрудника
exports.createAdminStaff = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // Добавим отладочную информацию
    console.log('Received data:', { name, email, phone, password });
    console.log('Name check:', !name, typeof name, name?.length);
    console.log('Email check:', !email, typeof email, email?.length);
    console.log('Password check:', !password, typeof password, password?.length);

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Имя, email и пароль обязательны' });
    }

    // Дополнительная проверка на пустые строки
    if (!name.trim() || !email.trim() || !password.trim()) {
      return res.status(400).json({ error: 'Имя, email и пароль обязательны (проверка на пустые строки)' });
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

    // Удаляем все закрепления клиентов за этим сотрудником
    await prisma.salesStaffAssignment.deleteMany({
      where: {
        salesStaffId: id
      }
    });

    // Удаляем сотрудника
    await prisma.user.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Сотрудник и все связанные данные успешно удалены'
    });
  } catch (error) {
    console.error('Error deleting admin staff:', error);
    res.status(500).json({ error: 'Ошибка при удалении сотрудника' });
  }
};

// Получение результатов по менеджерам
exports.getManagerResults = async (req, res) => {
  try {
    // Проверяем, что текущий пользователь - супер админ или сотрудник
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN_STAFF') {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    // Получаем всех сотрудников с ролью ADMIN_STAFF
    const managers = await prisma.user.findMany({
      where: {
        role: 'ADMIN_STAFF'
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Получаем данные о клиентах для каждого менеджера
    // В реальном приложении здесь должна быть логика подсчета клиентов
    // Пока используем заглушки для демонстрации
    const managersWithStats = await Promise.all(managers.map(async (manager) => {
      // Получаем закрепленных клиентов для этого менеджера
      const assignments = await prisma.salesStaffAssignment.findMany({
        where: {
          salesStaffId: manager.id
        }
      });

      const clientEmails = assignments.map(a => a.clientEmail);
      
      // Получаем информацию о клиентах (как в супер админ панели)
      const clients = await prisma.user.findMany({
        where: {
          email: {
            in: clientEmails
          }
        },
        include: {
          business: {
            include: {
              subscription: true // Получаем subscription как в супер админ панели
            }
          }
        }
      });

      // Считаем статистику на основе subscription.cardAttachedAt как в супер админ панели
      const totalClients = clients.length;
      const clientsWithCards = clients.filter(client => client.business?.subscription?.cardAttachedAt).length;
      
      // Считаем сумму подписок (заглушка - в реальном приложении будет логика подсчета)
      const subscriptionSum = clients.reduce((sum, client) => {
        if (client.isPaying && client.subscriptionType === 'monthly') {
          return sum + 500; // Заглушка: 500₽ в месяц
        } else if (client.isPaying && client.subscriptionType === 'yearly') {
          return sum + 5000; // Заглушка: 5000₽ в год
        }
        return sum;
      }, 0);

      // Считаем общие оплаты
      const totalPayments = clients.reduce((sum, client) => sum + (client.totalPaid || 0), 0);

      return {
        ...manager,
        totalClients,
        clientsWithCards,
        subscriptionSum,
        totalPayments
      };
    }));

    // Считаем общую статистику
    const totalManagers = managersWithStats.length;
    const totalClients = managersWithStats.reduce((sum, m) => sum + m.totalClients, 0);
    const totalWithCards = managersWithStats.reduce((sum, m) => sum + m.clientsWithCards, 0);
    const totalWithoutCards = totalClients - totalWithCards;

    res.json({
      success: true,
      totalManagers,
      totalClients,
      totalWithCards,
      totalWithoutCards,
      managers: managersWithStats
    });
  } catch (error) {
    console.error('Error getting manager results:', error);
    res.status(500).json({ error: 'Ошибка при получении результатов' });
  }
};

// Поиск клиентов
exports.searchClients = async (req, res) => {
  try {
    // Проверяем, что текущий пользователь - супер админ или сотрудник
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN_STAFF') {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const { q } = req.query;

    if (!q || q.length < 3) {
      return res.json({ clients: [] });
    }

    // Ищем пользователей по email (только обычные пользователи, не админы)
    const clients = await prisma.user.findMany({
      where: {
        email: {
          contains: q,
          mode: 'insensitive'
        },
        role: 'OWNER' // Только обычные пользователи
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        createdAt: true,
        cloudPaymentsCardToken: true // Добавляем токен карты для проверки статуса
      },
      take: 10,
      orderBy: { createdAt: 'desc' }
    });

    // Добавляем информацию о картах на основе реальных данных
    const clientsWithCardInfo = clients.map(client => ({
      ...client,
      hasCard: !!client.cloudPaymentsCardToken // Реальная проверка наличия привязанной карты
    }));

    res.json({
      success: true,
      clients: clientsWithCardInfo
    });
  } catch (error) {
    console.error('Error searching clients:', error);
    res.status(500).json({ error: 'Ошибка при поиске клиентов' });
  }
};

// Закрепление клиента за сотрудником
exports.assignClientToStaff = async (req, res) => {
  try {
    // Проверяем, что текущий пользователь - сотрудник
    if (req.user.role !== 'ADMIN_STAFF' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const { clientId } = req.body;
    const staffId = req.user.id;

    if (!clientId) {
      return res.status(400).json({ error: 'ID клиента обязателен' });
    }

    // Проверяем, существует ли клиент
    const client = await prisma.user.findUnique({
      where: { id: clientId }
    });

    if (!client) {
      return res.status(404).json({ error: 'Клиент не найден' });
    }

    // Проверяем, не закреплен ли клиент уже за этим сотрудником
    const existingAssignment = await prisma.salesStaffAssignment.findFirst({
      where: {
        salesStaffId: staffId,
        clientEmail: client.email
      }
    });

    if (existingAssignment) {
      return res.status(400).json({ error: 'Клиент уже закреплен за вами' });
    }

    // Закрепляем клиента за сотрудником
    await prisma.salesStaffAssignment.create({
      data: {
        salesStaffId: staffId,
        clientEmail: client.email,
        assignedBy: staffId
      }
    });

    res.json({
      success: true,
      message: 'Клиент успешно закреплен'
    });
  } catch (error) {
    console.error('Error assigning client:', error);
    res.status(500).json({ error: 'Ошибка при закреплении клиента' });
  }
};

// Получение закрепленных клиентов сотрудника
exports.getAssignedClients = async (req, res) => {
  try {
    // Проверяем, что текущий пользователь - сотрудник или супер админ
    if (req.user.role !== 'ADMIN_STAFF' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const staffId = req.user.id;
    console.log('[ADMIN-STAFF] Loading assigned clients for staff:', { 
      staffId, 
      staffEmail: req.user.email,
      role: req.user.role 
    });

    // Получаем все закрепления для этого сотрудника
    const assignments = await prisma.salesStaffAssignment.findMany({
      where: {
        salesStaffId: staffId
      },
      include: {
        salesStaff: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      },
      orderBy: { assignedAt: 'desc' }
    });

    // Получаем информацию о клиентах по email (как в супер админ панели)
    const clientEmails = assignments.map(a => a.clientEmail);
    const clients = await prisma.user.findMany({
      where: {
        email: {
          in: clientEmails
        }
      },
      include: {
        business: {
          include: {
            subscription: true // Получаем subscription как в супер админ панели
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Объединяем данные (как в супер админ панели)
    const assignedClients = assignments.map(assignment => {
      const client = clients.find(c => c.email === assignment.clientEmail);
      
      // Определяем статус карты на основе subscription.cardAttachedAt как в супер админ панели
      const hasCard = client && client.business?.subscription?.cardAttachedAt;
      
      console.log('[ADMIN-STAFF] Client card status (using subscription.cardAttachedAt):', {
        clientEmail: assignment.clientEmail,
        clientId: client?.id,
        subscriptionId: client?.business?.subscription?.id,
        cardAttachedAt: client?.business?.subscription?.cardAttachedAt,
        hasCard: hasCard
      });
      
      return {
        id: assignment.id,
        client: client ? {
          ...client,
          hasCard: hasCard,
          subscription: client.business?.subscription // Добавляем subscription как в супер админ панели
        } : null,
        assignedAt: assignment.assignedAt,
        assignedBy: assignment.assignedBy
      };
    }).filter(ac => ac.client !== null);

    console.log('[ADMIN-STAFF] Final assigned clients count:', assignedClients.length);

    res.json({
      success: true,
      clients: assignedClients
    });
  } catch (error) {
    console.error('Error getting assigned clients:', error);
    res.status(500).json({ error: 'Ошибка при получении закрепленных клиентов' });
  }
};

// Открепление клиента от сотрудника
exports.unassignClient = async (req, res) => {
  try {
    // Проверяем, что текущий пользователь - сотрудник или супер админ
    if (req.user.role !== 'ADMIN_STAFF' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const { assignmentId } = req.params;
    const staffId = req.user.id;

    // Проверяем, существует ли закрепление
    const assignment = await prisma.salesStaffAssignment.findUnique({
      where: { id: assignmentId }
    });

    if (!assignment) {
      return res.status(404).json({ error: 'Закрепление не найдено' });
    }

    // Проверяем, что закрепление принадлежит текущему сотруднику
    if (assignment.salesStaffId !== staffId && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Вы можете открепить только своих клиентов' });
    }

    // Удаляем закрепление
    await prisma.salesStaffAssignment.delete({
      where: { id: assignmentId }
    });

    res.json({
      success: true,
      message: 'Клиент успешно откреплен'
    });
  } catch (error) {
    console.error('Error unassigning client:', error);
    res.status(500).json({ error: 'Ошибка при откреплении клиента' });
  }
};
