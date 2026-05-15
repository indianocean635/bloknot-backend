const { prisma } = require("../services/prismaService");

// Link Telegram chatId to booking using booking token
async function linkBooking(req, res) {
  try {
    console.log('[TELEGRAM] Linking booking:', req.body);

    const { bookingToken, chatId, username } = req.body;

    if (!bookingToken || !chatId) {
      return res.status(400).json({ error: "Booking token and chatId are required" });
    }

    // Find booking by token
    const booking = await prisma.appointment.findUnique({
      where: { bookingToken },
      include: {
        service: true,
        master: true,
        business: true
      }
    });

    if (!booking) {
      return res.status(404).json({ error: "Invalid booking token" });
    }

    // Update booking with chatId
    const updated = await prisma.appointment.update({
      where: { id: booking.id },
      data: {
        telegramChatId: String(chatId),
        customerTelegram: username || customerTelegram
      },
      include: {
        service: true,
        master: true,
        business: true
      }
    });

    console.log('[TELEGRAM] Booking linked successfully:', updated.id);

    res.json({ booking: updated });
  } catch (error) {
    console.error('[TELEGRAM] Error linking booking:', error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Cancel booking
async function cancelBooking(req, res) {
  try {
    console.log('[TELEGRAM] Canceling booking:', req.body);

    const { bookingId, bookingToken, chatId } = req.body;

    if (!bookingId || !bookingToken || !chatId) {
      return res.status(400).json({ error: "Booking ID, token, and chatId are required" });
    }

    // Find booking and validate token
    const booking = await prisma.appointment.findUnique({
      where: { id: parseInt(bookingId) }
    });

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    // Validate token (security check)
    if (booking.bookingToken !== bookingToken) {
      console.error('[TELEGRAM] Token validation failed for booking:', bookingId);
      return res.status(403).json({ error: "Invalid token" });
    }

    // Validate chatId (user can only cancel their own booking)
    if (booking.telegramChatId !== String(chatId)) {
      console.error('[TELEGRAM] ChatId validation failed for booking:', bookingId);
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Update booking status to cancelled
    const updated = await prisma.appointment.update({
      where: { id: parseInt(bookingId) },
      data: { status: 'CANCELLED' }
    });

    console.log('[TELEGRAM] Booking cancelled successfully:', bookingId);

    res.json({ success: true });
  } catch (error) {
    console.error('[TELEGRAM] Error cancelling booking:', error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Generate reschedule link
async function generateRescheduleLink(req, res) {
  try {
    console.log('[TELEGRAM] Generating reschedule link:', req.body);

    const { bookingId, bookingToken, chatId } = req.body;

    if (!bookingId || !bookingToken || !chatId) {
      return res.status(400).json({ error: "Booking ID, token, and chatId are required" });
    }

    // Find booking and validate token
    const booking = await prisma.appointment.findUnique({
      where: { id: parseInt(bookingId) },
      include: {
        business: true
      }
    });

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    // Validate token (security check)
    if (booking.bookingToken !== bookingToken) {
      console.error('[TELEGRAM] Token validation failed for booking:', bookingId);
      return res.status(403).json({ error: "Invalid token" });
    }

    // Validate chatId (user can only reschedule their own booking)
    if (booking.telegramChatId !== String(chatId)) {
      console.error('[TELEGRAM] ChatId validation failed for booking:', bookingId);
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Generate reschedule URL
    const businessSlug = booking.business?.slug;
    const rescheduleUrl = `https://bloknotservis.ru/booking-new.html?slug=${businessSlug}&reschedule=${bookingToken}`;

    console.log('[TELEGRAM] Reschedule link generated for booking:', bookingId);

    res.json({ rescheduleUrl });
  } catch (error) {
    console.error('[TELEGRAM] Error generating reschedule link:', error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Send reminders for upcoming bookings
async function sendReminders(req, res) {
  try {
    console.log('[TELEGRAM] Sending reminders...');

    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    const twentyFourHoursLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Find bookings that need reminders
    const bookingsNeeding24hReminder = await prisma.appointment.findMany({
      where: {
        startsAt: {
          gte: now,
          lte: twentyFourHoursLater
        },
        reminderSent24h: false,
        telegramChatId: { not: null },
        status: 'PENDING'
      },
      include: {
        service: true,
        master: true,
        business: true
      }
    });

    const bookingsNeeding1hReminder = await prisma.appointment.findMany({
      where: {
        startsAt: {
          gte: now,
          lte: oneHourLater
        },
        reminderSent1h: false,
        telegramChatId: { not: null },
        status: 'PENDING'
      },
      include: {
        service: true,
        master: true,
        business: true
      }
    });

    const reminders = [];

    // Send 24h reminders
    for (const booking of bookingsNeeding24hReminder) {
      const dateStr = new Date(booking.startsAt).toLocaleDateString('ru-RU');
      const timeStr = new Date(booking.startsAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

      const message = `
⏰ Напоминание: Запись через 24 часа

📋 Услуга: ${booking.service?.name}
👨‍💼 Специалист: ${booking.master?.name}
📅 Дата: ${dateStr}
🕐 Время: ${timeStr}
🏢 ${booking.business?.name}
      `.trim();

      // Send via bot (using bot service)
      // Note: This will be handled by the bot service, we just mark as sent
      await prisma.appointment.update({
        where: { id: booking.id },
        data: { reminderSent24h: true }
      });

      reminders.push({
        bookingId: booking.id,
        type: '24h',
        chatId: booking.telegramChatId,
        message
      });
    }

    // Send 1h reminders
    for (const booking of bookingsNeeding1hReminder) {
      const dateStr = new Date(booking.startsAt).toLocaleDateString('ru-RU');
      const timeStr = new Date(booking.startsAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

      const message = `
⏰ Напоминание: Запись через 1 час

📋 Услуга: ${booking.service?.name}
👨‍💼 Специалист: ${booking.master?.name}
📅 Дата: ${dateStr}
🕐 Время: ${timeStr}
🏢 ${booking.business?.name}
      `.trim();

      await prisma.appointment.update({
        where: { id: booking.id },
        data: { reminderSent1h: true }
      });

      reminders.push({
        bookingId: booking.id,
        type: '1h',
        chatId: booking.telegramChatId,
        message
      });
    }

    console.log(`[TELEGRAM] Reminders sent: ${reminders.length}`);

    res.json({ reminders });
  } catch (error) {
    console.error('[TELEGRAM] Error sending reminders:', error);
    res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = {
  linkBooking,
  cancelBooking,
  generateRescheduleLink,
  sendReminders
};
