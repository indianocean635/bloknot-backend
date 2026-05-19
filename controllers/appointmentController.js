// Временное хранилище в памяти
const memoryAppointments = new Map();
const memoryUsers = new Map();
let appointmentId = 1;

const { prisma } = require("../services/prismaService");
const { bot } = require("../lib/telegram");

// Функция для парсинга даты
function parseDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

// Получить записи (защищенные)
async function getAppointments(req, res) {
  try {
    console.log('[REQUEST]', {
      userId: req.user?.id,
      businessId: req.user?.businessId,
      route: req.originalUrl
    });

    const user = req.user;
    
    if (!user || !user.businessId) {
      console.warn('[SECURITY] Missing businessId', { userId: user?.id });
      return res.status(403).json({ error: "Forbidden" });
    }
    
    const { from, to, masterId } = req.query;
    
    // Handle multiple masterIds (comma-separated)
    const masterIds = masterId ? masterId.split(',').map(id => Number(id.trim())) : null;
    
    // Загружаем записи из базы данных
    let items = await prisma.appointment.findMany({
      where: {
        businessId: user.businessId
      },
      include: {
        service: true,
        master: true,
        branch: true
      },
      orderBy: {
        startsAt: 'asc'
      }
    });
    
    // Фильтры по дате
    const fromDate = from ? parseDate(from) : null;
    const toDate = to ? parseDate(to) : null;
    
    if (fromDate) {
      items = items.filter(item => new Date(item.startsAt) >= fromDate);
    }
    if (toDate) {
      items = items.filter(item => new Date(item.startsAt) <= toDate);
    }
    if (masterIds) {
      items = items.filter(item => masterIds.includes(item.masterId));
    }
    
    // Сортировка
    items.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
    
    res.json(items);
  } catch (error) {
    console.error('❌ getAppointments error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// Получить записи (публичные)
async function getPublicAppointments(req, res) {
  try {
    const { from, to, masterId, businessId } = req.query;
    
    if (!businessId) {
      return res.status(400).json({ error: "Business ID is required" });
    }
    
    // Handle multiple masterIds (comma-separated)
    const masterIds = masterId ? masterId.split(',').map(id => Number(id.trim())) : null;
    
    let items = Array.from(memoryAppointments.values()).filter(item => 
      item.businessId === businessId
    );
    
    const fromDate = from ? parseDate(from) : null;
    const toDate = to ? parseDate(to) : null;
    
    if (fromDate) {
      items = items.filter(item => new Date(item.startsAt) >= fromDate);
    }
    if (toDate) {
      items = items.filter(item => new Date(item.startsAt) <= toDate);
    }
    if (masterIds) {
      items = items.filter(item => masterIds.includes(item.masterId));
    }
    
    items.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
    
    res.json(items);
  } catch (error) {
    console.error('❌ getPublicAppointments error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// Создать запись (публичный endpoint, без авторизации)
async function createPublicAppointment(req, res) {
  try {
    console.log('[PUBLIC APPOINTMENT REQUEST]', req.body);

    const {
      businessId,
      serviceId,
      masterId,
      branchId,
      startsAt,
      endsAt,
      customerName,
      customerPhone,
      customerTelegram,
      customerComment
    } = req.body;

    if (!businessId || !serviceId || !masterId || !startsAt || !endsAt || !customerName || !customerPhone) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Generate unique booking token
    const bookingToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    // Save to database
    const appointment = await prisma.appointment.create({
      data: {
        businessId,
        serviceId: Number(serviceId),
        masterId: Number(masterId),
        branchId: branchId ? Number(branchId) : null,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        customerName,
        customerPhone,
        customerTelegram,
        customerComment,
        status: 'PENDING',
        bookingToken
      }
    });

    console.log('✅ Public appointment created in DB:', appointment.id);

    // Send Telegram confirmation if chatId is linked
    if (appointment.telegramChatId) {
      try {
        const { sendBookingConfirmationMessage } = require('../services/telegramBotService');
        
        // Get full booking details for confirmation
        const fullBooking = await prisma.appointment.findUnique({
          where: { id: appointment.id },
          include: {
            service: true,
            master: true,
            business: true
          }
        });
        
        if (fullBooking) {
          await sendBookingConfirmationMessage(fullBooking, fullBooking.telegramChatId);
        }
      } catch (error) {
        console.error('Error sending Telegram confirmation:', error);
        // Continue even if Telegram fails
      }
    }

    res.json(appointment);
  } catch (error) {
    console.error('❌ createPublicAppointment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// Создать запись
async function createAppointment(req, res) {
  try {
    console.log('[REQUEST]', {
      userId: req.user?.id,
      businessId: req.user?.businessId,
      route: req.originalUrl
    });

    const user = req.user;
    
    if (!user || !user.businessId) {
      console.warn('[SECURITY] Missing businessId', { userId: user?.id });
      return res.status(403).json({ error: "Forbidden" });
    }

    const {
      serviceId,
      masterId,
      branchId,
      startsAt,
      endsAt,
      customerName,
      customerPhone,
      customerTelegram,
      customerComment,
      status,
      color
    } = req.body;

    if (!serviceId || !masterId || !startsAt || !endsAt || !customerName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Save to database
    const appointment = await prisma.appointment.create({
      data: {
        businessId: user.businessId,
        serviceId: Number(serviceId),
        masterId: Number(masterId),
        branchId: branchId ? Number(branchId) : null,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        customerName,
        customerPhone,
        customerTelegram: customerTelegram || null,
        customerComment: customerComment || null,
        status: status || 'CONFIRMED',
        color: color || null
      }
    });

    // Fetch the appointment with relations for the response
    const appointmentWithRelations = await prisma.appointment.findUnique({
      where: { id: appointment.id },
      include: {
        service: true,
        master: true,
        branch: true
      }
    });
    
    console.log('✅ Appointment created in DB:', appointment.id);
    res.json(appointmentWithRelations);
  } catch (error) {
    console.error('❌ createAppointment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// Обновить запись
async function updateAppointment(req, res) {
  try {
    console.log('[REQUEST]', {
      userId: req.user?.id,
      businessId: req.user?.businessId,
      route: req.originalUrl
    });

    const user = req.user;
    
    if (!user || !user.businessId) {
      console.warn('[SECURITY] Missing businessId', { userId: user?.id });
      return res.status(403).json({ error: "Forbidden" });
    }

    const { id } = req.params;
    
    // Check if appointment exists and belongs to user's business
    const existing = await prisma.appointment.findFirst({
      where: {
        id: Number(id),
        businessId: user.businessId
      }
    });
    
    if (!existing) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    
    const {
      serviceId,
      masterId,
      branchId,
      startsAt,
      endsAt,
      customerName,
      customerPhone,
      customerTelegram,
      customerComment,
      status,
      color
    } = req.body;
    
    // Update in database
    const appointment = await prisma.appointment.update({
      where: { id: Number(id) },
      data: {
        serviceId: serviceId ? Number(serviceId) : undefined,
        masterId: masterId ? Number(masterId) : undefined,
        branchId: branchId ? Number(branchId) : (branchId === null ? null : undefined),
        startsAt: startsAt ? new Date(startsAt) : undefined,
        endsAt: endsAt ? new Date(endsAt) : undefined,
        customerName,
        customerPhone,
        customerTelegram: customerTelegram !== undefined ? customerTelegram : undefined,
        customerComment: customerComment !== undefined ? customerComment : undefined,
        status,
        color: color !== undefined ? color : undefined
      }
    });

    // Fetch with relations for the response
    const appointmentWithRelations = await prisma.appointment.findUnique({
      where: { id: appointment.id },
      include: {
        service: true,
        master: true,
        branch: true
      }
    });
    
    console.log('✅ Appointment updated in DB:', id);
    res.json(appointmentWithRelations);
  } catch (error) {
    console.error('❌ updateAppointment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// Удалить запись
async function deleteAppointment(req, res) {
  try {
    console.log('[REQUEST]', {
      userId: req.user?.id,
      businessId: req.user?.businessId,
      route: req.originalUrl
    });

    const user = req.user;
    
    if (!user || !user.businessId) {
      console.warn('[SECURITY] Missing businessId', { userId: user?.id });
      return res.status(403).json({ error: "Forbidden" });
    }

    const { id } = req.params;
    
    // Check if appointment exists and belongs to user's business
    const existing = await prisma.appointment.findFirst({
      where: {
        id: Number(id),
        businessId: user.businessId
      }
    });
    
    if (!existing) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    
    // Delete from database
    await prisma.appointment.delete({
      where: { id: Number(id) }
    });
    
    console.log('✅ Appointment deleted from DB:', id);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ deleteAppointment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// Получить запись по ID (публичная)
async function getAppointmentById(req, res) {
  try {
    const { id } = req.params;
    const businessId = req.business?.id || 'business_1';
    
    const appointment = memoryAppointments.get(Number(id));
    
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    
    // Проверяем что запись принадлежит бизнесу
    if (appointment.businessId !== businessId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    console.log('✅ Appointment retrieved by ID:', id);
    res.json(appointment);
  } catch (error) {
    console.error('❌ getAppointmentById error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = {
  getAppointments,
  getPublicAppointments,
  createPublicAppointment,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  getAppointmentById
};
