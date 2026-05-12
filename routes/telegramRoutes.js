const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { bot } = require('../lib/telegram');

// POST /api/telegram/webhook - Telegram bot webhook
router.post('/webhook', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.sendStatus(200);
    }

    const chatId = message.chat.id;
    const text = message.text;

    if (text === '/start') {
      // User started the bot, send welcome message
      await bot.sendMessage(chatId, 'Добро пожаловать в Bloknot Booking Bot!\n\nЧтобы получать уведомления о записях, введите ваш номер телефона в формате: +7XXXXXXXXXX');
    } else if (text.match(/^\+?\d{10,15}$/)) {
      // User entered phone number, save chat_id
      const phone = text.replace(/\D/g, '');

      // Find the most recent appointment with this phone
      const appointment = await prisma.appointment.findFirst({
        where: {
          customerPhone: {
            contains: phone
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (appointment) {
        // Update appointment with chatId
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: { telegramChatId: chatId.toString() }
        });

        await bot.sendMessage(chatId, 'Отлично! Теперь вы будете получать уведомления о записях в Telegram.');
      } else {
        await bot.sendMessage(chatId, 'Не найдено записей с этим номером телефона. Убедитесь, что номер введен правильно.');
      }
    } else {
      // Unknown command
      await bot.sendMessage(chatId, 'Чтобы подключить уведомления, введите ваш номер телефона в формате: +7XXXXXXXXXX');
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Telegram webhook error:', error);
    res.sendStatus(200);
  }
});

module.exports = router;
