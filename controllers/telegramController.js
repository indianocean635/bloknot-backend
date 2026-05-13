const { prisma } = require("../services/prismaService");

// Generate unique token
function generateToken() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < 16; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Create Telegram link for connection
async function createTelegramLink(req, res) {
  try {
    console.log('[TELEGRAM] Creating link for user:', req.user?.id);

    const userId = req.user?.id;
    const bookingId = req.body.bookingId;

    // Generate unique token
    let token;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      token = generateToken();
      attempts++;
      const existing = await prisma.telegramLink.findUnique({ where: { token } });
      if (!existing) break;
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      return res.status(500).json({ error: "Failed to generate unique token" });
    }

    // Create Telegram link
    const telegramLink = await prisma.telegramLink.create({
      data: {
        token,
        userId,
        bookingId
      }
    });

    // Return telegram URL
    const telegramUrl = `https://t.me/bloknot_booking_bot?start=${token}`;

    res.json({ telegramUrl, token });
  } catch (error) {
    console.error('[TELEGRAM] Error creating link:', error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Connect Telegram account
async function connectTelegram(req, res) {
  try {
    console.log('[TELEGRAM] Connecting account:', req.body);

    const { token, chatId, username } = req.body;

    if (!token || !chatId) {
      return res.status(400).json({ error: "Token and chatId are required" });
    }

    // Find telegram link by token
    const telegramLink = await prisma.telegramLink.findUnique({
      where: { token }
    });

    if (!telegramLink) {
      return res.status(404).json({ error: "Invalid token" });
    }

    // Update telegram link with connection info
    const updated = await prisma.telegramLink.update({
      where: { id: telegramLink.id },
      data: {
        chatId: String(chatId),
        username,
        connected: true
      }
    });

    // If there's a bookingId, update the appointment with chatId
    if (updated.bookingId) {
      await prisma.appointment.updateMany({
        where: { id: parseInt(updated.bookingId) },
        data: { telegramChatId: String(chatId) }
      });
    }

    console.log('[TELEGRAM] Account connected successfully:', updated);

    res.json({ success: true });
  } catch (error) {
    console.error('[TELEGRAM] Error connecting account:', error);
    res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = {
  createTelegramLink,
  connectTelegram
};
