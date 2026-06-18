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

    // Проверяем подписку владельца бизнеса
    const { prisma } = require('../services/prismaService');
    const { updateSubscriptionStatusIfNeeded } = require('../middleware/subscriptionMiddleware');
    
    // Получаем бизнес для проверки подписки владельца
    const business = await prisma.business.findUnique({
      where: { id: req.body.businessId },
      include: { owner: true }
    });

    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    console.log('[SUBSCRIPTION] Checking business owner subscription:', {
      businessId: req.body.businessId,
      ownerId: business.ownerId,
      currentStatus: business.owner.subscriptionStatus
    });

    // Обновляем статус подписки если необходимо
    const updatedSubscription = await updateSubscriptionStatusIfNeeded(business.owner);

    // Проверяем активность подписки - TRIAL всегда считается активным
    if (updatedSubscription.status === 'TRIAL') {
      console.log('[SUBSCRIPTION] TRIAL subscription - allowing public appointments:', {
        businessId: req.body.businessId,
        ownerId: business.ownerId,
        status: updatedSubscription.status
      });
    } else if (!updatedSubscription.isActive) {
      console.log('[SUBSCRIPTION] Public appointment blocked - subscription expired:', {
        businessId: req.body.businessId,
        ownerId: business.ownerId,
        status: updatedSubscription.status
      });

      return res.status(403).json({
        error: 'Онлайн-запись временно недоступна. Владелец аккаунта не продлил подписку.',
        code: 'SUBSCRIPTION_EXPIRED',
        subscriptionStatus: updatedSubscription.status
      });
    }

    console.log('[SUBSCRIPTION] Public appointment allowed - subscription active:', {
      businessId: req.body.businessId,
      ownerId: business.ownerId,
      status: updatedSubscription.status
    });

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

    console.log('[STEP 1] Validating required fields');

    if (!businessId || !serviceId || !masterId || !startsAt || !endsAt || !customerName || !customerPhone) {
      console.log('[STEP 1] Missing required fields:', { businessId, serviceId, masterId, startsAt, endsAt, customerName, customerPhone });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const startDate = new Date(startsAt);
    const endDate = new Date(endsAt);

    console.log('[STEP 2] Checking for conflicts with businessId:', businessId, 'masterId:', masterId);
    console.log('[STEP 2] New appointment:', startDate, 'to', endDate);

    // Check for time conflicts with existing appointments for the same master
    const existingAppointments = await prisma.appointment.findMany({
      where: {
        masterId: Number(masterId),
        businessId: businessId,
        status: {
          in: ['CONFIRMED', 'PENDING']
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

    console.log('[STEP 2] Existing appointments found:', existingAppointments.length);
    if (existingAppointments.length > 0) {
      console.log('[STEP 2] Conflicting appointments:', existingAppointments.map(a => ({
        id: a.id,
        startsAt: a.startsAt,
        endsAt: a.endsAt,
        status: a.status
      })));
    }

    // Filter out cancelled appointments from conflicts
    const activeConflicts = existingAppointments.filter(a => a.status !== 'CANCELLED');

    if (activeConflicts.length > 0) {
      console.log('[STEP 2] ❌ Time slot conflict detected for master:', masterId);
      return res.status(409).json({
        error: 'Это время уже занято. Пожалуйста, выберите другое время.'
      });
    }

    console.log('[STEP 3] ✅ No conflicts, creating appointment...');

    // Check if user has existing Telegram chatId from previous bookings
    let existingChatId = null;
    if (customerPhone || customerTelegram) {
      // Normalize phone number for comparison (remove all non-digit characters)
      const normalizedPhone = customerPhone ? customerPhone.replace(/\D/g, '') : null;

      console.log('[STEP 4] [TELEGRAM] Searching for existing chatId with phone:', normalizedPhone, 'telegram:', customerTelegram);

      const existingBooking = await prisma.appointment.findFirst({
        where: {
          OR: [
            { customerPhone: normalizedPhone || undefined },
            { customerTelegram: customerTelegram || undefined }
          ],
          telegramChatId: { not: null }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (existingBooking && existingBooking.telegramChatId) {
        existingChatId = existingBooking.telegramChatId;
        console.log('[STEP 4] [TELEGRAM] Found existing chatId for user:', existingChatId);
      } else {
        console.log('[STEP 4] [TELEGRAM] No existing chatId found for user');
      }
    }

    // Generate unique booking token
    const bookingToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    // Extract branchId from object if needed
    const branchIdValue = branchId && typeof branchId === 'object' ? branchId.id : branchId;

    console.log('[STEP 5] Branch ID:', branchIdValue);

    // Save to database
    // Parse local time string and treat it as UTC+3 (Moscow time)
    // Format: 2026-05-27T09:00:00
    const startsAtDate = new Date(startsAt + '+03:00');
    const endsAtDate = new Date(endsAt + '+03:00');

    // Normalize phone number for storage
    const normalizedPhoneForStorage = customerPhone ? customerPhone.replace(/\D/g, '') : customerPhone;

    console.log('[STEP 6] Creating appointment in DB...');

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
        customerPhone: normalizedPhoneForStorage,
        customerTelegram,
        customerComment,
        status: 'PENDING',
        bookingToken,
        telegramChatId: existingChatId // Auto-link if user has existing chatId
      }
    });

    console.log('[STEP 6] ✅ Appointment created in DB:', appointment.id);

    // Send Telegram confirmation if user has existing chatId
    if (appointment.telegramChatId) {
      console.log('[STEP 7] Sending Telegram confirmation...');
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
          console.log('[STEP 7] [TELEGRAM] Auto-confirmation sent for booking:', appointment.id);
        }
      } catch (error) {
        console.error('[STEP 7] Error sending Telegram confirmation:', error);
        // Continue even if Telegram fails
      }
    } else {
      console.log('[STEP 7] Skipping Telegram - no chatId');
    }

    // Send WhatsApp confirmation automatically if phone is provided
    if (customerPhone) {
      console.log('[STEP 7.5] Sending WhatsApp confirmation automatically...');
      try {
        const { sendWhatsAppTemplateMessage } = require('../services/whatsappService');

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
          // Format date and time
          const timeToUse = fullBooking.startsAtLocal || fullBooking.startsAt;
          const dateStr = timeToUse.replace(/(\d{4})-(\d{2})-(\d{2})T.*/, '$3.$2.$1');
          const timeStr = timeToUse.replace(/.*T(\d{2}):(\d{2}).*/, '$1:$2');

          // Generate booking link from business slug
          const domain = process.env.DOMAIN || process.env.FRONTEND_URL || 'https://bloknotservis.ru';
          const bookingLink = `${domain}/book/${fullBooking.business?.slug}`;

          console.log('[WHATSAPP TEMPLATE] BOOKING LINK:', bookingLink);

          // Prepare template variables
          const templateVariables = {
            customer_name: customerName,
            date: dateStr,
            time: timeStr,
            specialist: fullBooking.master?.name,
            service: fullBooking.service?.name,
            booking_link: bookingLink
          };

          console.log('[WHATSAPP TEMPLATE NAME]', 'booking_confirmation_simple');
          console.log('[WHATSAPP BOOKING LINK]', bookingLink);
          console.log('[WHATSAPP VARIABLES]', JSON.stringify(templateVariables, null, 2));
          console.log('[WHATSAPP VARIABLES COUNT]', Object.keys(templateVariables).length);
          
          // Проверка что все 6 переменных на месте
          const expectedVars = ['customer_name', 'date', 'time', 'specialist', 'service', 'booking_link'];
          const actualVars = Object.keys(templateVariables);
          const missingVars = expectedVars.filter(v => !actualVars.includes(v));
          
          if (missingVars.length > 0) {
            console.error('[WHATSAPP TEMPLATE] MISSING VARIABLES:', missingVars);
          } else {
            console.log('[WHATSAPP TEMPLATE] ALL 6 VARIABLES PRESENT ✅');
          }
          
          // Проверка значений
          expectedVars.forEach(varName => {
            console.log(`[WHATSAPP TEMPLATE] ${varName}:`, templateVariables[varName]);
          });

          // Send WhatsApp template message (fire and forget) to not block response
          sendWhatsAppTemplateMessage(
            customerPhone,
            'booking_confirmation_simple',
            'ru',
            templateVariables
          )
            .then(() => console.log('[STEP 7.5] [WHATSAPP TEMPLATE] Auto-confirmation sent for booking:', appointment.id))
            .catch((error) => {
              console.error('[STEP 7.5] Error sending WhatsApp confirmation:', error);
              console.error('[STEP 7.5] WhatsApp Error Status:', error.response?.status);
              console.error('[STEP 7.5] WhatsApp Error Data:', JSON.stringify(error.response?.data, null, 2));
              if (error.response?.data?.error) {
                console.error('[STEP 7.5] Meta API Error Code:', error.response.data.error.code);
                console.error('[STEP 7.5] Meta API Error Type:', error.response.data.error.type);
                console.error('[STEP 7.5] Meta API Error Message:', error.response.data.error.message);
              }
            });
        }
      } catch (error) {
        console.error('[STEP 7.5] Error sending WhatsApp confirmation:', error);
        console.error('[STEP 7.5] WhatsApp Error Status:', error.response?.status);
        console.error('[STEP 7.5] WhatsApp Error Data:', JSON.stringify(error.response?.data, null, 2));
        if (error.response?.data?.error) {
          console.error('[STEP 7.5] Meta API Error Code:', error.response.data.error.code);
          console.error('[STEP 7.5] Meta API Error Type:', error.response.data.error.type);
          console.error('[STEP 7.5] Meta API Error Message:', error.response.data.error.message);
        }
        // Continue even if WhatsApp fails
      }
    } else {
      console.log('[STEP 7.5] Skipping WhatsApp - no phone provided');
    }

    // Send VK confirmation if VK user ID is provided
    if (req.body.vkUserId) {
      console.log('[STEP 7.6] Sending VK confirmation...');
      try {
        const { sendBookingConfirmation } = require('../services/vkNotificationService');

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
          // Format date and time
          const timeToUse = fullBooking.startsAtLocal || fullBooking.startsAt;
          const dateStr = timeToUse.replace(/(\d{4})-(\d{2})-(\d{2})T.*/, '$3.$2.$1');
          const timeStr = timeToUse.replace(/.*T(\d{2}):(\d{2}).*/, '$1:$2');

          // Generate booking link from business slug
          const domain = process.env.DOMAIN || process.env.FRONTEND_URL || 'https://bloknotservis.ru';
          const bookingLink = `${domain}/book/${fullBooking.business?.slug}`;

          console.log('[VK NOTIFICATION] BOOKING LINK:', bookingLink);

          const templateVariables = {
            customer_name: fullBooking.customerName,
            date: dateStr,
            time: timeStr,
            specialist: fullBooking.master?.name || 'Специалист',
            service: fullBooking.service?.name || 'Услуга',
            booking_link: bookingLink
          };

          console.log('[VK NOTIFICATION] TEMPLATE VARIABLES:', JSON.stringify(templateVariables, null, 2));

          // Send VK confirmation message (fire and forget) to not block response
          sendBookingConfirmation(req.body.vkUserId, templateVariables)
            .then(() => console.log('[STEP 7.6] [VK NOTIFICATION] Auto-confirmation sent for booking:', appointment.id))
            .catch((error) => {
              console.error('[STEP 7.6] Error sending VK confirmation:', error);
              console.error('[STEP 7.6] VK Error Status:', error.response?.status);
              console.error('[STEP 7.6] VK Error Data:', JSON.stringify(error.response?.data, null, 2));
              if (error.response?.data?.error) {
                console.error('[STEP 7.6] VK API Error Code:', error.response.data.error.error_code);
                console.error('[STEP 7.6] VK API Error Message:', error.response.data.error.error_msg);
              }
            });
        }
      } catch (error) {
        console.error('[STEP 7.6] Error sending VK confirmation:', error);
        console.error('[STEP 7.6] VK Error Status:', error.response?.status);
        console.error('[STEP 7.6] VK Error Data:', JSON.stringify(error.response?.data, null, 2));
        if (error.response?.data?.error) {
          console.error('[STEP 7.6] VK API Error Code:', error.response.data.error.error_code);
          console.error('[STEP 7.6] VK API Error Message:', error.response.data.error.error_msg);
        }
        // Continue even if VK fails
      }
    } else {
      console.log('[STEP 7.6] Skipping VK - no VK user ID');
    }

    console.log('[STEP 8] Sending response to client');
    res.json(appointment);
    console.log('[STEP 8] ✅ Response sent successfully');
  } catch (error) {
    console.error('[ERROR] ❌ createPublicAppointment error:', error);
    console.error('[ERROR] Error stack:', error.stack);
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

    // Проверяем подписку пользователя
    const { updateSubscriptionStatusIfNeeded } = require('../middleware/subscriptionMiddleware');
    
    console.log('[SUBSCRIPTION] Checking user subscription for appointment creation:', {
      userId: user.id,
      businessId: user.businessId,
      currentStatus: user.subscriptionStatus
    });

    // Обновляем статус подписки если необходимо
    const updatedSubscription = await updateSubscriptionStatusIfNeeded(user);

    // Проверяем активность подписки - TRIAL всегда считается активным
    if (updatedSubscription.status === 'TRIAL') {
      console.log('[SUBSCRIPTION] TRIAL subscription - allowing appointment creation:', {
        userId: user.id,
        businessId: user.businessId,
        status: updatedSubscription.status
      });
    } else if (!updatedSubscription.isActive) {
      console.log('[SUBSCRIPTION] Appointment creation blocked - subscription expired:', {
        userId: user.id,
        businessId: user.businessId,
        status: updatedSubscription.status
      });

      return res.status(403).json({
        error: 'Создание записей временно недоступно. Продлите подписку для продолжения работы.',
        code: 'SUBSCRIPTION_EXPIRED',
        subscriptionStatus: updatedSubscription.status
      });
    }

    console.log('[SUBSCRIPTION] Appointment creation allowed - subscription active:', {
      userId: user.id,
      businessId: user.businessId,
      status: updatedSubscription.status
    });

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
      },
      include: {
        service: true,
        master: true,
        business: true
      }
    });

    // Send VK reschedule notification if VK user ID is present and time/date changed
    if (appointment.customerVkId && (startsAt || endsAt)) {
      try {
        const { sendReschedule } = require('../services/vkNotificationService');
        
        const timeToUse = appointment.startsAtLocal || appointment.startsAt;
        const dateStr = timeToUse.replace(/(\d{4})-(\d{2})-(\d{2})T.*/, '$3.$2.$1');
        const timeStr = timeToUse.replace(/.*T(\d{2}):(\d{2}).*/, '$1:$2');

        const domain = process.env.DOMAIN || process.env.FRONTEND_URL || 'https://bloknotservis.ru';
        const bookingLink = `${domain}/book/${appointment.business?.slug}`;

        const templateVariables = {
          customer_name: appointment.customerName,
          date: dateStr,
          time: timeStr,
          specialist: appointment.master?.name || 'Специалист',
          service: appointment.service?.name || 'Услуга',
          booking_link: bookingLink
        };

        sendReschedule(appointment.customerVkId, templateVariables)
          .then(() => console.log('[APPOINTMENT] VK reschedule sent for appointment:', id))
          .catch((error) => console.error('[APPOINTMENT] Error sending VK reschedule:', error));
      } catch (error) {
        console.error('[APPOINTMENT] Error sending VK reschedule notification:', error);
      }
    }

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

    res.json({
      success: true,
      data: {
        appointment: appointment
      }
    });
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

// Создание кода привязки VK
async function createVKLinkCode(req, res) {
  try {
    const { id } = req.params;
    
    // Получаем данные записи
    const appointment = await prisma.appointment.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Запись не найдена'
      });
    }
    
    // Временно создаем VK код без отдельной таблицы
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'VK-';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Сохраняем код в bookingToken для поиска
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { 
        bookingToken: code.replace('VK-', 'vk') // vkXXXXXX
      }
    });
    
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 часа
    
    res.json({
      success: true,
      data: {
        code,
        expiresAt,
        appointmentId: appointment.id,
        customerName: appointment.customerName,
        customerPhone: appointment.customerPhone
      }
    });
    
  } catch (error) {
    console.error('[VK REQUEST] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка создания кода привязки'
    });
  }
}

// Создание кода привязки VK по токену
async function createVKLinkCodeByToken(req, res) {
  try {
    const { token } = req.params;
    
    // Получаем данные записи по токену
    const appointment = await prisma.appointment.findFirst({
      where: { 
        bookingToken: token,
        status: 'PENDING'
      }
    });
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Запись не найдена или не подтверждена'
      });
    }
    
    // Временно создаем VK код без отдельной таблицы
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'VK-';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Сохраняем код в bookingToken для поиска
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { 
        bookingToken: code.replace('VK-', 'vk') // vkXXXXXX
      }
    });
    
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 часа
    
    res.json({
      success: true,
      data: {
        code,
        expiresAt,
        appointmentId: appointment.id,
        customerName: appointment.customerName,
        customerPhone: appointment.customerPhone
      }
    });
    
  } catch (error) {
    console.error('[VK REQUEST BY TOKEN] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка создания кода привязки'
    });
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
  getPublicAppointmentByToken,
  createVKLinkCode,
  createVKLinkCodeByToken
};
