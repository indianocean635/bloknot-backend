const express = require('express');
const { sendWhatsAppMessage } = require('../services/whatsappService');

const router = express.Router();

/**
 * POST /api/notifications/whatsapp-booking
 * Send WhatsApp booking confirmation message
 */
router.post('/whatsapp-booking', async (req, res) => {
  try {
    const {
      customerName,
      phone,
      service,
      date,
      time,
      specialist,
      bookingId
    } = req.body;

    console.log('[WHATSAPP BOOKING] Sending booking confirmation:', {
      customerName,
      phone,
      service,
      date,
      time,
      specialist,
      bookingId
    });

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Format message
    const message = `Здравствуйте, ${customerName}!

Вы записаны:
📅 Дата: ${date}
⏰ Время: ${time}
✂️ Услуга: ${service}
👤 Специалист: ${specialist}

Для управления записью нажмите кнопку ниже.`;

    // Create interactive buttons
    const buttons = [
      {
        id: `reschedule_${bookingId}`,
        title: 'Перенести запись'
      },
      {
        id: `cancel_${bookingId}`,
        title: 'Отменить запись'
      }
    ];

    // Send WhatsApp message
    await sendWhatsAppMessage(phone, message, buttons);

    console.log('[WHATSAPP BOOKING] Message sent successfully');
    res.json({ success: true, message: 'WhatsApp notification sent' });
  } catch (error) {
    console.error('[WHATSAPP BOOKING] Error:', error);
    res.status(500).json({ error: 'Failed to send WhatsApp notification' });
  }
});

/**
 * POST /api/notifications/whatsapp-reminder
 * Send WhatsApp reminder message
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

module.exports = router;
