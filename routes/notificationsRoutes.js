const express = require('express');
const { sendWhatsAppMessage } = require('../services/whatsappService');

const router = express.Router();

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

module.exports = router;
