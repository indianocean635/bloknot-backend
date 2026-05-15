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
    if (masterId) {
      items = items.filter(item => item.masterId === Number(masterId));
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
    if (masterId) {
      items = items.filter(item => item.masterId === Number(masterId));
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

    const appointment = {
      id: appointmentId++,
      ...req.body,
      businessId: user.businessId, // Обязательно добавляем businessId
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    memoryAppointments.set(appointment.id, appointment);
    
    console.log('✅ Appointment created:', appointment.id);
    res.json(appointment);
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
    const appointment = memoryAppointments.get(Number(id));
    
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    
    // Проверяем, что запись принадлежит бизнесу пользователя
    if (appointment.businessId !== user.businessId) {
      console.warn('[SECURITY] Attempting to update appointment from different business', { 
        userId: user.id, 
        businessId: user.businessId, 
        appointmentBusinessId: appointment.businessId 
      });
      return res.status(404).json({ error: "Appointment not found" });
    }
    
    const updated = { ...appointment, ...req.body, updatedAt: new Date() };
    memoryAppointments.set(Number(id), updated);
    
    console.log('✅ Appointment updated:', id);
    res.json(updated);
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
    const appointment = memoryAppointments.get(Number(id));
    
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    
    // Проверяем, что запись принадлежит бизнесу пользователя
    if (appointment.businessId !== user.businessId) {
      console.warn('[SECURITY] Attempting to delete appointment from different business', { 
        userId: user.id, 
        businessId: user.businessId, 
        appointmentBusinessId: appointment.businessId 
      });
      return res.status(404).json({ error: "Appointment not found" });
    }
    
    memoryAppointments.delete(Number(id));
    
    console.log('✅ Appointment deleted:', id);
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
