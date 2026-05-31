const { prisma } = require('../services/prismaService');
const { sendWhatsAppMessage } = require('./whatsappService');

/**
 * Check and send WhatsApp reminders for upcoming appointments
 * This function should be called periodically (e.g., every hour)
 */
async function checkAndSendReminders() {
  try {
    console.log('[WHATSAPP REMINDERS] Checking for appointments that need reminders...');

    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in1Hour = new Date(now.getTime() + 1 * 60 * 60 * 1000);

    // Check if WhatsApp is enabled
    if (process.env.WHATSAPP_ENABLED !== 'true') {
      console.log('[WHATSAPP REMINDERS] WhatsApp notifications are disabled');
      return;
    }

    // Find appointments in the next 24 hours that haven't received 24h reminder
    // Note: In production, you should track which reminders were sent in the database
    // For now, we'll send reminders based on time windows
    
    // Get appointments starting in approximately 24 hours (23-25 hours from now)
    const appointments24h = await prisma.appointment.findMany({
      where: {
        status: 'CONFIRMED',
        startsAt: {
          gte: new Date(now.getTime() + 23 * 60 * 60 * 1000),
          lte: new Date(now.getTime() + 25 * 60 * 60 * 1000)
        },
        customerPhone: {
          not: null
        }
      },
      include: {
        service: true,
        master: true,
        business: true
      }
    });

    console.log(`[WHATSAPP REMINDERS] Found ${appointments24h.length} appointments for 24h reminder`);

    for (const appointment of appointments24h) {
      try {
        const timeToUse = appointment.startsAtLocal || appointment.startsAt;
        const dateStr = timeToUse.replace(/(\d{4})-(\d{2})-(\d{2})T.*/, '$3.$2.$1');
        const timeStr = timeToUse.replace(/.*T(\d{2}):(\d{2}).*/, '$1:$2');

        const message = `Здравствуйте, ${appointment.customerName}!

Напоминаем о вашей записи завтра:
📅 Дата: ${dateStr}
⏰ Время: ${timeStr}
✂️ Услуга: ${appointment.service?.name}
👤 Специалист: ${appointment.master?.name}

Ждем вас!`;

        await sendWhatsAppMessage(appointment.customerPhone, message);
        console.log(`[WHATSAPP REMINDERS] 24h reminder sent for appointment ${appointment.id}`);
      } catch (error) {
        console.error(`[WHATSAPP REMINDERS] Error sending 24h reminder for appointment ${appointment.id}:`, error);
      }
    }

    // Get appointments starting in approximately 1 hour (50-70 minutes from now)
    const appointments1h = await prisma.appointment.findMany({
      where: {
        status: 'CONFIRMED',
        startsAt: {
          gte: new Date(now.getTime() + 50 * 60 * 1000),
          lte: new Date(now.getTime() + 70 * 60 * 1000)
        },
        customerPhone: {
          not: null
        }
      },
      include: {
        service: true,
        master: true,
        business: true
      }
    });

    console.log(`[WHATSAPP REMINDERS] Found ${appointments1h.length} appointments for 1h reminder`);

    for (const appointment of appointments1h) {
      try {
        const timeToUse = appointment.startsAtLocal || appointment.startsAt;
        const dateStr = timeToUse.replace(/(\d{4})-(\d{2})-(\d{2})T.*/, '$3.$2.$1');
        const timeStr = timeToUse.replace(/.*T(\d{2}):(\d{2}).*/, '$1:$2');

        const message = `Здравствуйте, ${appointment.customerName}!

Напоминаем о вашей записи через час:
📅 Дата: ${dateStr}
⏰ Время: ${timeStr}
✂️ Услуга: ${appointment.service?.name}
👤 Специалист: ${appointment.master?.name}

Ждем вас!`;

        await sendWhatsAppMessage(appointment.customerPhone, message);
        console.log(`[WHATSAPP REMINDERS] 1h reminder sent for appointment ${appointment.id}`);
      } catch (error) {
        console.error(`[WHATSAPP REMINDERS] Error sending 1h reminder for appointment ${appointment.id}:`, error);
      }
    }

    console.log('[WHATSAPP REMINDERS] Reminder check completed');
  } catch (error) {
    console.error('[WHATSAPP REMINDERS] Error checking reminders:', error);
  }
}

module.exports = {
  checkAndSendReminders
};
