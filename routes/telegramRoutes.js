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
        // Send connection data to backend
        try {
          const response = await fetch('https://bloknotservis.ru/api/telegram/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token,
              chatId,
              username
            })
          });

          if (response.ok) {
            await bot.sendMessage(chatId, 'Telegram успешно подключен ✅');
          } else {
            await bot.sendMessage(chatId, 'Ошибка подключения. Недействительный токен.');
          }
        } catch (error) {
          console.error('Error connecting Telegram:', error);
          await bot.sendMessage(chatId, 'Ошибка подключения. Попробуйте позже.');
        }
      }
    } else if (text === '/start') {
      // User started the bot without token
      await bot.sendMessage(chatId, 'Добро пожаловать в Bloknot Booking Bot!\n\nДля подключения уведомлений, перейдите по ссылке из формы записи.');
    } else {
      // Unknown command
      await bot.sendMessage(chatId, 'Для подключения уведомлений, используйте ссылку из формы записи.');
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Telegram webhook error:', error);
    res.sendStatus(200);
  }
});

module.exports = router;
