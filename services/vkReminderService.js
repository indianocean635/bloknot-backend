const { prisma } = require('../services/prismaService');
const { sendReminder24h, sendReminder1h } = require('./vkNotificationService');

/**
 * Check and send VK reminders for upcoming appointments
 * This function should be called periodically (e.g., every hour)
 */
async function checkAndSendVKReminders() {
  try {
    console.log('[VK REMINDERS] Checking for appointments that need VK reminders...');

    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in1Hour = new Date(now.getTime() + 1 * 60 * 60 * 1000);

    // Check if VK notifications are enabled
    if (process.env.VK_NOTIFICATIONS_ENABLED !== 'true') {
      console.log('[VK REMINDERS] VK notifications are disabled');
      return;
    }

    // Find appointments in the next 24 hours that haven't received 24h VK reminder
    const appointments24h = await prisma.appointment.findMany({
      where: {
        status: 'CONFIRMED',
        startsAt: {
          gte: new Date(now.getTime() + 23 * 60 * 60 * 1000),
          lte: new Date(now.getTime() + 25 * 60 * 60 * 1000)
        },
        customerVkId: {
          not: null
        },
        vkReminderSent24h: false
      },
      include: {
        service: true,
        master: true,
        business: true
      }
    });

    console.log(`[VK REMINDERS] Found ${appointments24h.length} appointments for 24h VK reminder`);

    for (const appointment of appointments24h) {
      try {
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

        await sendReminder24h(appointment.customerVkId, templateVariables);
        
        // Mark reminder as sent
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: { vkReminderSent24h: true }
        });
        
        console.log(`[VK REMINDERS] 24h VK reminder sent for appointment ${appointment.id}`);
      } catch (error) {
        console.error(`[VK REMINDERS] Error sending 24h VK reminder for appointment ${appointment.id}:`, error);
      }
    }

    // Find appointments starting in approximately 1 hour that haven't received 1h VK reminder
    const appointments1h = await prisma.appointment.findMany({
      where: {
        status: 'CONFIRMED',
        startsAt: {
          gte: new Date(now.getTime() + 50 * 60 * 1000),
          lte: new Date(now.getTime() + 70 * 60 * 1000)
        },
        customerVkId: {
          not: null
        },
        vkReminderSent1h: false
      },
      include: {
        service: true,
        master: true,
        business: true
      }
    });

    console.log(`[VK REMINDERS] Found ${appointments1h.length} appointments for 1h VK reminder`);

    for (const appointment of appointments1h) {
      try {
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

        await sendReminder1h(appointment.customerVkId, templateVariables);
        
        // Mark reminder as sent
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: { vkReminderSent1h: true }
        });
        
        console.log(`[VK REMINDERS] 1h VK reminder sent for appointment ${appointment.id}`);
      } catch (error) {
        console.error(`[VK REMINDERS] Error sending 1h VK reminder for appointment ${appointment.id}:`, error);
      }
    }

    console.log('[VK REMINDERS] VK Reminder check completed');
  } catch (error) {
    console.error('[VK REMINDERS] Error checking VK reminders:', error);
  }
}

module.exports = {
  checkAndSendVKReminders
};
