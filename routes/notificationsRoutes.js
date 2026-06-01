const express = require('express');
const { sendWhatsAppMessage } = require('../services/whatsappService');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /api/notifications/whatsapp-reminder
 * Send WhatsApp reminder message (used by scheduler)
 */
router.post('/whatsapp-reminder', async (req, res) => {
  try {
    const {
      customerName,
      phone,
      date,
      time,
      service,
      bookingId,
      reminderType // '24h' or '1h'
    } = req.body;

    console.log('[WHATSAPP REMINDER] Sending reminder:', {
      customerName,
      phone,
      date,
      time,
      service,
      bookingId,
      reminderType
    });

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    let message;
    if (reminderType === '24h') {
      message = `Здравствуйте, ${customerName}!

Напоминаем о вашей записи завтра:
📅 Дата: ${date}
⏰ Время: ${time}
✂️ Услуга: ${service}

Ждем вас!`;
    } else if (reminderType === '1h') {
      message = `Здравствуйте, ${customerName}!

Напоминаем о вашей записи через час:
📅 Дата: ${date}
⏰ Время: ${time}
✂️ Услуга: ${service}

Ждем вас!`;
    } else {
      return res.status(400).json({ error: 'Invalid reminder type' });
    }

    // Send WhatsApp message (no buttons for reminders)
    await sendWhatsAppMessage(phone, message);

    console.log('[WHATSAPP REMINDER] Message sent successfully');
    res.json({ success: true, message: 'WhatsApp reminder sent' });
  } catch (error) {
    console.error('[WHATSAPP REMINDER] Error:', error);
    res.status(500).json({ error: 'Failed to send WhatsApp reminder' });
  }
});

/**
 * POST /api/notifications/whatsapp-webhook
 * WhatsApp webhook for handling interactive button replies
 */
router.post('/whatsapp-webhook', async (req, res) => {
  try {
    console.log('[WHATSAPP WEBHOOK] Received webhook payload:', JSON.stringify(req.body, null, 2));

    const entry = req.body.entry?.[0];
    if (!entry) {
      console.log('[WHATSAPP WEBHOOK] No entry in payload');
      return res.status(200).json({ status: 'ok' });
    }

    const changes = entry.changes?.[0];
    if (!changes) {
      console.log('[WHATSAPP WEBHOOK] No changes in entry');
      return res.status(200).json({ status: 'ok' });
    }

    const value = changes.value;
    if (!value) {
      console.log('[WHATSAPP WEBHOOK] No value in changes');
      return res.status(200).json({ status: 'ok' });
    }

    // Check if this is a message (interactive button reply)
    const messages = value.messages;
    if (!messages || messages.length === 0) {
      console.log('[WHATSAPP WEBHOOK] No messages in value');
      return res.status(200).json({ status: 'ok' });
    }

    const message = messages[0];
    console.log('[WHATSAPP WEBHOOK] Message type:', message.type);

    // Handle interactive button reply
    if (message.type === 'interactive' && message.interactive) {
      const interactive = message.interactive;
      console.log('[WHATSAPP BUTTON] Interactive type:', interactive.type);

      if (interactive.type === 'button_reply' && interactive.button_reply) {
        const buttonReply = interactive.button_reply;
        const payload = buttonReply.id;
        const phone = message.from;

        console.log('[WHATSAPP BUTTON] Button clicked - Phone:', phone, 'Payload:', payload);

        // Parse payload: action:booking_id
        const [action, bookingId] = payload.split(':');

        if (!action || !bookingId) {
          console.error('[WHATSAPP BUTTON] Invalid payload format:', payload);
          await sendWhatsAppMessage(phone, 'Ошибка: неверный формат кнопки');
          return res.status(200).json({ status: 'ok' });
        }

        console.log('[WHATSAPP BUTTON] Action:', action, 'Booking ID:', bookingId);

        // Handle different actions
        if (action === 'cancel_booking') {
          await handleCancelBooking(phone, bookingId);
        } else if (action === 'reschedule_booking') {
          await handleRescheduleBooking(phone, bookingId);
        } else {
          console.error('[WHATSAPP BUTTON] Unknown action:', action);
          await sendWhatsAppMessage(phone, 'Ошибка: неизвестное действие');
        }
      }
    }

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('[WHATSAPP WEBHOOK] Error:', error);
    console.error('[WHATSAPP WEBHOOK] Error stack:', error.stack);
    res.status(200).json({ status: 'ok' }); // Always return 200 to WhatsApp
  }
});

/**
 * GET /api/notifications/whatsapp-webhook
 * WhatsApp webhook verification
 */
router.get('/whatsapp-webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('[WHATSAPP WEBHOOK] Verification request - Mode:', mode, 'Token:', token);

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'bloknot_whatsapp_verify';

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[WHATSAPP WEBHOOK] Webhook verified');
    res.status(200).send(challenge);
  } else {
    console.log('[WHATSAPP WEBHOOK] Webhook verification failed');
    res.status(403).json({ error: 'Forbidden' });
  }
});

/**
 * Handle cancel booking action
 */
async function handleCancelBooking(phone, bookingId) {
  try {
    console.log('[BOOKING CANCEL] Starting cancellation for booking:', bookingId, 'Phone:', phone);

    const booking = await prisma.appointment.findUnique({
      where: { id: parseInt(bookingId) },
      include: {
        service: true,
        master: true,
        branch: true
      }
    });

    if (!booking) {
      console.error('[BOOKING CANCEL] Booking not found:', bookingId);
      await sendWhatsAppMessage(phone, 'Запись не найдена. Пожалуйста, свяжитесь с администратором.');
      return;
    }

    console.log('[BOOKING CANCEL] Booking found:', booking.id, 'Current status:', booking.status);

    // Update status to cancelled
    await prisma.appointment.update({
      where: { id: booking.id },
      data: { status: 'cancelled' }
    });

    console.log('[BOOKING STATUS UPDATED] Booking', booking.id, 'status changed to: cancelled');

    // Send confirmation to client
    const message = `Запись отменена:
📅 Дата: ${new Date(booking.startsAt).toLocaleDateString('ru-RU')}
⏰ Время: ${new Date(booking.startsAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
✂️ Услуга: ${booking.service?.name}
👤 Специалист: ${booking.master?.name}

Если вы хотите записаться снова, перейдите на наш сайт.`;

    await sendWhatsAppMessage(phone, message);
    console.log('[BOOKING CANCEL] Confirmation sent to client');
  } catch (error) {
    console.error('[BOOKING CANCEL] Error:', error);
    console.error('[BOOKING CANCEL] Error stack:', error.stack);
    await sendWhatsAppMessage(phone, 'Ошибка при отмене записи. Пожалуйста, свяжитесь с администратором.');
  }
}

/**
 * Handle reschedule booking action
 */
async function handleRescheduleBooking(phone, bookingId) {
  try {
    console.log('[BOOKING RESCHEDULE] Starting reschedule for booking:', bookingId, 'Phone:', phone);

    const booking = await prisma.appointment.findUnique({
      where: { id: parseInt(bookingId) },
      include: {
        service: true,
        master: true,
        branch: true
      }
    });

    if (!booking) {
      console.error('[BOOKING RESCHEDULE] Booking not found:', bookingId);
      await sendWhatsAppMessage(phone, 'Запись не найдена. Пожалуйста, свяжитесь с администратором.');
      return;
    }

    console.log('[BOOKING RESCHEDULE] Booking found:', booking.id);

    // Send reschedule link
    const rescheduleUrl = `https://bloknotservis.ru/booking/edit/${booking.id}`;
    const message = `Для переноса записи перейдите по ссылке:
${rescheduleUrl}

📅 Текущая запись: ${new Date(booking.startsAt).toLocaleDateString('ru-RU')}
⏰ Время: ${new Date(booking.startsAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
✂️ Услуга: ${booking.service?.name}
👤 Специалист: ${booking.master?.name}`;

    await sendWhatsAppMessage(phone, message);
    console.log('[BOOKING RESCHEDULE] Reschedule link sent to client:', rescheduleUrl);
  } catch (error) {
    console.error('[BOOKING RESCHEDULE] Error:', error);
    console.error('[BOOKING RESCHEDULE] Error stack:', error.stack);
    await sendWhatsAppMessage(phone, 'Ошибка при получении ссылки для переноса. Пожалуйста, свяжитесь с администратором.');
  }
}

module.exports = router;
