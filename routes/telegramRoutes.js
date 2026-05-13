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

    let replyText = '';

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
            replyText = 'Telegram успешно подключен ✅\n\nТеперь вы будете получать уведомления о записях.';
          } else {
            replyText = 'Ошибка подключения. Недействительный токен.';
          }
        } catch (error) {
          console.error('Error connecting Telegram:', error);
          replyText = 'Ошибка подключения. Попробуйте позже.';
        }
      }
    } else if (text === '/start') {
      // User started the bot without token
      replyText = 'Бот подключен ✅\n\nДля получения уведомлений о записей, используйте ссылку из формы записи.';
    } else {
      // Unknown command
      replyText = 'Для подключения уведомлений, используйте ссылку из формы записи.';
    }

    // Send reply via Telegram API using fetch with proxy if configured
    if (replyText) {
      try {
        const fetchOptions = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: replyText
          })
        };

        // Use proxy if configured
        if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) {
          const { HttpsProxyAgent } = require('https-proxy-agent');
          const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
          fetchOptions.agent = new HttpsProxyAgent(proxyUrl);
        }

        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, fetchOptions);
      } catch (error) {
        console.error('Error sending Telegram reply:', error);
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Telegram webhook error:', error);
    res.sendStatus(200);
  }
});

module.exports = router;
