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
    
    console.log('getPublicAppointments called with:', { from, to, masterId, businessId });
    
    if (!businessId) {
      return res.status(400).json({ error: "Business ID is required" });
    }
    
    // Handle multiple masterIds (comma-separated)
    const masterIds = masterId ? masterId.split(',').map(id => Number(id.trim())) : null;
    
    // Query from database instead of memory storage
    let items = await prisma.appointment.findMany({
      where: {
        businessId: businessId,
        status: {
          in: ['PENDING', 'CONFIRMED']
        }
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
    
    console.log('Total appointments in DB:', items.length);

    const fromDate = from ? parseDate(from) : null;
    const toDate = to ? parseDate(to) : null;

    console.log('Date filter:', { from, to, fromDate, toDate });

    if (fromDate) {
      // Set fromDate to start of day (00:00:00) using local time
      fromDate.setHours(0, 0, 0, 0);
      items = items.filter(item => new Date(item.startsAt) >= fromDate);
    }
    if (toDate) {
      // Set toDate to end of day (23:59:59) using local time
      toDate.setHours(23, 59, 59, 999);
      items = items.filter(item => new Date(item.startsAt) <= toDate);
    }
    if (masterIds) {
      items = items.filter(item => masterIds.includes(item.masterId));
    }

    console.log('Filtered appointments:', items.length);
    
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

    const startDate = new Date(startsAt);
    const endDate = new Date(endsAt);

    console.log('Checking for conflicts with businessId:', businessId, 'masterId:', masterId);
    console.log('New appointment:', startDate, 'to', endDate);

    // Check for time conflicts with existing appointments for the same master
    const existingAppointments = await prisma.appointment.findMany({
      where: {
        masterId: Number(masterId),
        businessId: businessId,
        status: {
          in: ['CONFIRMED']
        },
        OR: [
          {
            // New appointment starts during an existing appointment
            AND: [
              { startsAt: { lte: startDate } },
              { endsAt: { gt: startDate } }
            ]
          },
          {
            // New appointment ends during an existing appointment
            AND: [
              { startsAt: { lt: endDate } },
              { endsAt: { gte: endDate } }
            ]
          },
          {
            // New appointment completely contains an existing appointment
            AND: [
              { startsAt: { gte: startDate } },
              { endsAt: { lte: endDate } }
            ]
          }
        ]
      }
    });

    console.log('Existing appointments found:', existingAppointments.length);
    if (existingAppointments.length > 0) {
      console.log('Conflicting appointments:', existingAppointments.map(a => ({
        id: a.id,
        startsAt: a.startsAt,
        endsAt: a.endsAt,
        status: a.status
      })));
    }

    if (existingAppointments.length > 0) {
      console.log('❌ Time slot conflict detected for master:', masterId);
      return res.status(409).json({
        error: 'Это время уже занято. Пожалуйста, выберите другое время.'
      });
    }

    console.log('✅ No conflicts, creating appointment...');

    // Check if user has existing Telegram chatId from previous bookings
    let existingChatId = null;
    if (customerPhone || customerTelegram) {
      const existingBooking = await prisma.appointment.findFirst({
        where: {
          OR: [
            { customerPhone: customerPhone || undefined },
            { customerTelegram: customerTelegram || undefined }
          ],
          telegramChatId: { not: null }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (existingBooking && existingBooking.telegramChatId) {
        existingChatId = existingBooking.telegramChatId;
        console.log('[TELEGRAM] Found existing chatId for user:', existingChatId);
      }
    }

    // Generate unique booking token
    const bookingToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    // Extract branchId from object if needed
    const branchIdValue = branchId && typeof branchId === 'object' ? branchId.id : branchId;

    console.log('Branch ID:', branchIdValue);

    // Save to database
    // Parse local time string and treat it as UTC+3 (Moscow time)
    // Format: 2026-05-27T09:00:00
    const startsAtDate = new Date(startsAt + '+03:00');
    const endsAtDate = new Date(endsAt + '+03:00');

    const appointment = await prisma.appointment.create({
      data: {
        businessId,
        serviceId: Number(serviceId),
        masterId: Number(masterId),
        branchId: branchIdValue ? Number(branchIdValue) : null,
        startsAt: startsAtDate,
        endsAt: endsAtDate,
        startsAtLocal: startsAt, // Store original time as string without timezone conversion
        endsAtLocal: endsAt,     // Store original end time as string without timezone conversion
        customerName,
        customerPhone,
        customerTelegram,
        customerComment,
        status: 'PENDING',
        bookingToken,
        telegramChatId: existingChatId // Auto-link if user has existing chatId
      }
    });

    console.log('✅ Appointment created in DB:', appointment.id);

    // Send Telegram confirmation if user has existing chatId
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
          console.log('[TELEGRAM] Auto-confirmation sent for booking:', appointment.id);
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
      status
    } = req.body;

    if (!serviceId || !masterId || !startsAt || !customerName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Calculate endsAt if not provided
    let calculatedEndsAt = endsAt ? new Date(endsAt) : null;
    if (!calculatedEndsAt) {
      // Fetch service to get duration
      const service = await prisma.service.findUnique({
        where: { id: Number(serviceId) }
      });
      
      if (service && service.duration) {
        calculatedEndsAt = new Date(new Date(startsAt).getTime() + service.duration * 60000);
      } else {
        // Default to 1 hour if no service duration found
        calculatedEndsAt = new Date(new Date(startsAt).getTime() + 60 * 60000);
      }
    }

    const startDate = new Date(startsAt);
    const endDate = calculatedEndsAt;

    // Check for time conflicts with existing appointments for the same master
    const existingAppointments = await prisma.appointment.findMany({
      where: {
        masterId: Number(masterId),
        businessId: user.businessId,
        status: {
          in: ['CONFIRMED']
        },
        OR: [
          {
            // New appointment starts during an existing appointment
            AND: [
              { startsAt: { lte: startDate } },
              { endsAt: { gt: startDate } }
            ]
          },
          {
            // New appointment ends during an existing appointment
            AND: [
              { startsAt: { lt: endDate } },
              { endsAt: { gte: endDate } }
            ]
          },
          {
            // New appointment completely contains an existing appointment
            AND: [
              { startsAt: { gte: startDate } },
              { endsAt: { lte: endDate } }
            ]
          }
        ]
      }
    });

    if (existingAppointments.length > 0) {
      console.log('❌ Time slot conflict detected for master:', masterId);
      return res.status(409).json({ 
        error: 'Это время уже занято. Пожалуйста, выберите другое время.' 
      });
    }

    // Save to database
    const appointment = await prisma.appointment.create({
      data: {
        businessId: user.businessId,
        serviceId: Number(serviceId),
        masterId: Number(masterId),
        branchId: branchId ? Number(branchId) : null,
        startsAt: new Date(startsAt),
        endsAt: calculatedEndsAt,
        customerName,
        customerPhone,
        customerTelegram: customerTelegram || null,
        customerComment: customerComment || null,
        status: status || 'CONFIRMED'
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
      status
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
        status
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

// Публичное удаление записи (для онлайн записи)
async function deletePublicAppointment(req, res) {
  try {
    const { id } = req.params;
    
    // Check if appointment exists
    const existing = await prisma.appointment.findFirst({
      where: {
        id: Number(id)
      }
    });
    
    if (!existing) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    
    // Delete from database
    await prisma.appointment.delete({
      where: { id: Number(id) }
    });
    
    console.log('✅ Public appointment deleted from DB:', id);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ deletePublicAppointment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// Получить запись по токену (публичная)
async function getPublicAppointmentByToken(req, res) {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { bookingToken: token },
      include: {
        service: true,
        master: true,
        business: true
      }
    });

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    if (appointment.status === 'CANCELLED') {
      return res.status(410).json({ error: "Appointment already cancelled" });
    }

    res.json(appointment);
  } catch (error) {
    console.error('❌ getPublicAppointmentByToken error:', error);
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
  deletePublicAppointment,
  getAppointmentById,
  getPublicAppointmentByToken
};
