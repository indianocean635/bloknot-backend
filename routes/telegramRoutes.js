const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { bot } = require('../lib/telegram');
const { requireMagicAuth } = require('../middleware/magicAuthMiddleware');
const { createTelegramLink, connectTelegram } = require('../controllers/telegramController');

// POST /api/telegram/create-link - Create Telegram connection link
router.post('/create-link', requireMagicAuth, createTelegramLink);

// POST /api/telegram/connect - Connect Telegram account (called by bot)
router.post('/connect', connectTelegram);

// POST /api/telegram/webhook - Telegram bot webhook
router.post('/webhook', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.sendStatus(200);
    }

    const chatId = message.chat.id;
    const text = message.text;
    const username = message.from?.username;

    if (text && text.startsWith('/start ')) {
      // Extract token from /start TOKEN
      const token = text.replace('/start ', '').trim();

      if (token) {
        // Send connection data to backend (silently, no reply due to API block)
        try {
          await fetch('https://bloknotservis.ru/api/telegram/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token,
              chatId,
              username
            })
          });
          console.log('[TELEGRAM WEBHOOK] Connection processed for chatId:', chatId);
        } catch (error) {
          console.error('[TELEGRAM WEBHOOK] Error connecting:', error);
        }
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Telegram webhook error:', error);
    res.sendStatus(200);
  }
});

module.exports = router;
