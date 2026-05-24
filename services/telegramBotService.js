const { Telegraf } = require('telegraf');
const { HttpsProxyAgent } = require('https-proxy-agent');
require('dotenv').config();

const botConfig = {};

// Use proxy if configured
if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) {
  const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  const agent = new HttpsProxyAgent(proxyUrl);
  botConfig.telegram = { agent };
  console.log('[TELEGRAM BOT] Using proxy:', proxyUrl);
}

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN, botConfig);

// Handle /start command with payload (deep-link)
bot.start(async (ctx) => {
  const payload = ctx.startPayload;

  console.log('[TELEGRAM BOT] START payload:', payload);

  if (!payload) {
    await ctx.reply('Бот подключен ✅\n\nДля получения уведомлений о записях, используйте ссылку из формы записи.');
    return;
  }

  try {
    // Send connection data to backend
    const response = await fetch('https://bloknotservis.ru/api/telegram/link-booking', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bookingToken: payload,
        chatId: ctx.chat.id,
        username: ctx.from.username
      })
    });

    if (response.ok) {
      const result = await response.json();
      const booking = result.booking;
      
      // Send confirmation message with buttons
      await sendBookingConfirmation(ctx, booking);
      
      console.log('[CONFIRMATION SENT] Booking ID:', booking.id, 'Chat ID:', ctx.chat.id);
    } else {
      await ctx.reply('Ошибка подключения. Недействительный токен.');
    }
  } catch (error) {
    console.error('[TELEGRAM BOT] Error connecting:', error);
    await ctx.reply('Ошибка подключения. Попробуйте позже.');
  }
});

// Send booking confirmation with action buttons
async function sendBookingConfirmation(ctx, booking) {
  // Use startsAtLocal directly as text without any Date conversion
  // Format: 2026-05-27T10:00:00
  const timeToUse = booking.startsAtLocal || booking.startsAt;
  
  // Format: 2026-05-27T10:00:00 -> 27.05.2026 10:00
  const dateTimeStr = timeToUse.replace(
    /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}).*/,
    '$3.$2.$1 $4:$5'
  );

  const message = `
✅ Запись подтверждена!

📋 Услуга: ${booking.service?.name}
👨‍💼 Специалист: ${booking.master?.name}
📅 Дата и время: ${dateTimeStr}
🏢 ${booking.business?.name}
📞 Телефон: ${booking.customerPhone}

Управление записью:
https://bloknotservis.ru/booking?slug=${booking.business?.slug}&token=${booking.bookingToken}
Ждем вас!
  `.trim();

  await ctx.reply(message, {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '❌ Отменить запись',
            callback_data: `cancel_${booking.id}`
          }
        ],
        [
          {
            text: '� Перенести запись',
            url: 'https://bloknotservis.ru/booking'
          }
        ]
      ]
    }
  });
}

// Handle callback queries (button presses)
bot.on('callback_query', async (ctx) => {
  const callbackQuery = ctx.callbackQuery;
  
  if (!callbackQuery?.data) {
    await ctx.answerCbQuery();
    return;
  }

  const data = callbackQuery.data;
  const chatId = ctx.chat.id;

  console.log('[TELEGRAM BOT] Callback received:', data, 'Chat ID:', chatId);

  try {
    if (data.startsWith('cancel_')) {
      const bookingId = data.replace('cancel_', '');
      
      // Call backend to cancel booking
      const response = await fetch('https://bloknotservis.ru/api/telegram/cancel-booking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bookingId: bookingId,
          chatId: chatId
        })
      });

      if (response.ok) {
        await ctx.editMessageText('❌ Ваша запись отменена');
        await ctx.answerCbQuery();
        console.log('[BOOKING CANCELLED] Booking ID:', bookingId, 'Chat ID:', chatId);
      } else {
        await ctx.answerCbQuery('Ошибка при отмене записи', { show_alert: true });
      }
    } else {
      await ctx.answerCbQuery();
    }
  } catch (error) {
    console.error('[TELEGRAM BOT] Error handling callback:', error);
    await ctx.answerCbQuery('Произошла ошибка. Попробуйте позже.', { show_alert: true });
  }
});

// Handle other commands
bot.on('message', (ctx) => {
  console.log('[TELEGRAM BOT] Message received:', ctx.message.text);
});

// Function to send booking confirmations (can be called from backend)
async function sendBookingConfirmationMessage(booking, chatId) {
  const maxRetries = 3;
  const retryDelay = 1000; // 1 second

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Use startsAtLocal directly as text without any Date conversion
      // Format: 2026-05-27T10:00:00
      const timeToUse = booking.startsAtLocal || booking.startsAt;
      
      // Format: 2026-05-27T10:00:00 -> 27.05.2026 10:00
      const dateTimeStr = timeToUse.replace(
        /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}).*/,
        '$3.$2.$1 $4:$5'
      );

      const message = `
✅ Запись подтверждена!

📋 Услуга: ${booking.service?.name}
👨‍💼 Специалист: ${booking.master?.name}
📅 Дата и время: ${dateTimeStr}
🏢 ${booking.business?.name}
📞 Телефон: ${booking.customerPhone}

Управление записью:
https://bloknotservis.ru/booking?slug=${booking.business?.slug}&token=${booking.bookingToken}
Ждем вас!
      `.trim();

      await bot.telegram.sendMessage(chatId, message, {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '❌ Отменить запись',
                callback_data: `cancel_${booking.id}`
              }
            ],
            [
              {
                text: '📅 Перенести запись',
                url: 'https://bloknotservis.ru/booking'
              }
            ]
          ]
        }
      });
      console.log('[CONFIRMATION SENT] Booking ID:', booking.id, 'Chat ID:', chatId);
      return; // Success, exit function
    } catch (error) {
      console.error(`[TELEGRAM BOT] Error sending confirmation (attempt ${attempt}/${maxRetries}):`);
      console.error('[TELEGRAM BOT] Error:', error);
      console.error('[TELEGRAM BOT] Error message:', error.message);
      console.error('[TELEGRAM BOT] Error code:', error.code);
      console.error('[TELEGRAM BOT] Error stack:', error.stack);
      
      if (attempt < maxRetries) {
        console.log(`[TELEGRAM BOT] Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        console.error('[TELEGRAM BOT] Failed to send confirmation after all retries');
      }
    }
  }
}

// Function to send reminders
async function sendReminderMessage(reminder) {
  try {
    await bot.telegram.sendMessage(reminder.chatId, reminder.message);
    console.log('[REMINDER SENT] Booking ID:', reminder.bookingId, 'Type:', reminder.type);
  } catch (error) {
    console.error('[TELEGRAM BOT] Error sending reminder:', error);
  }
}

// Graceful shutdown
process.once('SIGINT', () => {
  console.log('[TELEGRAM BOT] Received SIGINT, stopping bot...');
  if (bot && bot.isRunning) {
    bot.stop('SIGINT');
  } else {
    console.log('[TELEGRAM BOT] Bot is not running, skipping stop');
  }
});

process.once('SIGTERM', () => {
  console.log('[TELEGRAM BOT] Received SIGTERM, stopping bot...');
  if (bot && bot.isRunning) {
    bot.stop('SIGTERM');
  } else {
    console.log('[TELEGRAM BOT] Bot is not running, skipping stop');
  }
});

// Start bot with conflict handling
async function startBot() {
  try {
    // First, try to get webhook info to check if another instance is running
    const webhookInfo = await bot.telegram.getWebhookInfo();
    console.log('[TELEGRAM BOT] Webhook info:', webhookInfo);
    
    // If webhook is set, remove it to use polling
    if (webhookInfo.url) {
      await bot.telegram.deleteWebhook();
      console.log('[TELEGRAM BOT] Webhook removed, switching to polling');
    }
    
    // Start polling
    await bot.launch();
    console.log('[TELEGRAM BOT] Bot started successfully with polling');
    
    // Set up reminder system
    if (process.env.ENABLE_REMINDERS !== 'false') {
      setupReminderSystem();
    }
    
  } catch (error) {
    if (error.error_code === 409) {
      console.error('[TELEGRAM BOT] 409 Conflict: Another bot instance is already running');
      console.log('[TELEGRAM BOT] Please stop the other bot instance first');
      process.exit(1);
    } else {
      console.error('[TELEGRAM BOT] Error starting bot:', error);
      process.exit(1);
    }
  }
}

// Setup reminder system
function setupReminderSystem() {
  console.log('⏰ Reminder system started (every hour)');
  
  // Send reminders every hour
  setInterval(async () => {
    try {
      const response = await fetch('https://bloknotservis.ru/api/telegram/send-reminders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        
        // Send reminder messages
        for (const reminder of result.reminders) {
          await sendReminderMessage(reminder);
        }
        
        console.log(`[REMINDERS] Sent ${result.reminders.length} reminders`);
      }
    } catch (error) {
      console.error('[REMINDERS] Error sending reminders:', error);
    }
  }, 60 * 60 * 1000); // Every hour
}

// Export functions for external use
module.exports = {
  bot,
  sendBookingConfirmationMessage,
  sendReminderMessage,
  startBot
};

// Start bot if this file is run directly
if (require.main === module) {
  console.log('🚀 Starting Telegram Bot...');
  console.log('📡 Mode: Polling');
  console.log('🔗 Backend URL: https://bloknotservis.ru');
  
  // Start health check server
  const express = require('express');
  const healthApp = express();
  
  healthApp.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  
  healthApp.listen(8080, () => {
    console.log('🚀 Health check server listening on port 8080');
  });
  
  // Start the bot
  startBot();
}
