const { Telegraf } = require('telegraf');
const { HttpsProxyAgent } = require('https-proxy-agent');
require('dotenv').config();

const proxyAgent = process.env.HTTPS_PROXY
  ? new HttpsProxyAgent(process.env.HTTPS_PROXY)
  : undefined;

console.log('[TELEGRAM BOT] Proxy agent enabled:', !!proxyAgent);

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN, {
  telegram: {
    agent: proxyAgent
  }
});

// Track processed callback IDs to prevent duplicate processing
const processedCallbacks = new Set();

// Handle /start command with payload (deep-link)
bot.start(async (ctx) => {
  const payload = ctx.startPayload;

  console.log('[TELEGRAM BOT] START payload:', payload);

  if (!payload) {
    await ctx.reply('╨С╨╛╤В ╨┐╨╛╨┤╨║╨╗╤О╤З╨╡╨╜ тЬЕ\n\n╨Ф╨╗╤П ╨┐╨╛╨╗╤Г╤З╨╡╨╜╨╕╤П ╤Г╨▓╨╡╨┤╨╛╨╝╨╗╨╡╨╜╨╕╨╣ ╨╛ ╨╖╨░╨┐╨╕╤Б╤П╤Е, ╨╕╤Б╨┐╨╛╨╗╤М╨╖╤Г╨╣╤В╨╡ ╤Б╤Б╤Л╨╗╨║╤Г ╨╕╨╖ ╤Д╨╛╤А╨╝╤Л ╨╖╨░╨┐╨╕╤Б╨╕.');
    return;
  }

  try {
    // Send connection data to backend with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch('https://bloknotservis.ru/api/telegram/link-booking', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bookingToken: payload,
        chatId: ctx.chat.id,
        username: ctx.from.username
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (response.ok) {
      const result = await response.json();
      const booking = result.booking;

      // Confirmation message is sent from backend controller
      console.log('[TELEGRAM BOT] Booking linked, confirmation sent from backend:', booking.id);
    } else {
      console.log('[TELEGRAM BOT] Backend response status:', response.status);
      const errorText = await response.text();
      console.log('[TELEGRAM BOT] Backend error response:', errorText);
      await ctx.reply('╨Ю╤И╨╕╨▒╨║╨░ ╨┐╨╛╨┤╨║╨╗╤О╤З╨╡╨╜╨╕╤П. ╨Э╨╡╨┤╨╡╨╣╤Б╤В╨▓╨╕╤В╨╡╨╗╤М╨╜╤Л╨╣ ╤В╨╛╨║╨╡╨╜.');
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('[TELEGRAM BOT] Request timeout after 30 seconds');
      await ctx.reply('╨б╨╡╤А╨▓╨╡╤А ╨┐╨╡╤А╨╡╨│╤А╤Г╨╢╨╡╨╜. ╨Я╨╛╨┐╤А╨╛╨▒╤Г╨╣╤В╨╡ ╨┐╨╛╨┤╨║╨╗╤О╤З╨╕╤В╤М Telegram ╨┐╨╛╨╖╨╢╨╡ ╤З╨╡╤А╨╡╨╖ ╤Д╨╛╤А╨╝╤Г ╨╖╨░╨┐╨╕╤Б╨╕.');
    } else {
      console.error('[TELEGRAM BOT] Error connecting:', error);
      await ctx.reply('╨Ю╤И╨╕╨▒╨║╨░ ╨┐╨╛╨┤╨║╨╗╤О╤З╨╡╨╜╨╕╤П. ╨Я╨╛╨┐╤А╨╛╨▒╤Г╨╣╤В╨╡ ╨┐╨╛╨╖╨╢╨╡.');
    }
  }
});

// Handle callback queries (button presses)
bot.on('callback_query', async (ctx) => {
  console.log('[TELEGRAM BOT] Callback query received');
  const callbackQuery = ctx.callbackQuery;
  const callbackId = callbackQuery.id;

  if (!callbackQuery?.data) {
    console.log('[TELEGRAM BOT] No callback data, answering empty');
    await ctx.answerCbQuery();
    return;
  }

  // Prevent duplicate processing
  if (processedCallbacks.has(callbackId)) {
    console.log('[TELEGRAM BOT] Callback already processed, skipping:', callbackId);
    return;
  }
  processedCallbacks.add(callbackId);

  // Clean up old callback IDs (keep last 1000)
  if (processedCallbacks.size > 1000) {
    const firstItem = processedCallbacks.values().next().value;
    processedCallbacks.delete(firstItem);
  }

  const data = callbackQuery.data;
  const chatId = ctx.chat.id;

  console.log('[TELEGRAM BOT] Callback received:', data, 'Chat ID:', chatId, 'Callback ID:', callbackId);

  try {
    if (data.startsWith('cancel_')) {
      const bookingId = data.substring(7); // Remove 'cancel_' prefix (7 characters)
      console.log('[TELEGRAM BOT] Processing cancel for booking:', bookingId);

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

      console.log('[TELEGRAM BOT] Cancel response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        const { booking } = result;

        console.log('[TELEGRAM BOT] Cancel result:', result);

        // Format date and time for cancellation message
        const timeToUse = booking?.startsAtLocal || booking?.startsAt;
        const dateStr = timeToUse?.replace(/(\d{4})-(\d{2})-(\d{2})T.*/, '$3.$2.$1') || '';
        const timeStr = timeToUse?.replace(/.*T(\d{2}):(\d{2}).*/, '$1:$2') || '';

        const cancelMessage = `
тЭМ ╨Ч╨░╨┐╨╕╤Б╤М ╨╛╤В╨╝╨╡╨╜╨╡╨╜╨░

ЁЯУЕ ${dateStr}
ЁЯХР ${timeStr}
ЁЯСитАНЁЯТ╝ ${booking?.master?.name || ''}
        `.trim();

        try {
          await ctx.editMessageText(cancelMessage, {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: 'ЁЯУЕ ╨Я╨╡╤А╨╡╨╖╨░╨┐╨╕╤Б╨░╤В╤М╤Б╤П',
                    url: `https://bloknotservis.ru/booking-new.html?slug=${booking.business?.slug}`
                  }
                ]
              ]
            }
          });
        } catch (editError) {
          // If edit fails (e.g., query too old), send a new message instead
          console.log('[TELEGRAM BOT] Edit message failed, sending new message:', editError.message);
          await ctx.reply(cancelMessage, {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: 'ЁЯУЕ ╨Я╨╡╤А╨╡╨╖╨░╨┐╨╕╤Б╨░╤В╤М╤Б╤П',
                    url: `https://bloknotservis.ru/booking-new.html?slug=${booking.business?.slug}`
                  }
                ]
              ]
            }
          });
        }

        try {
          await ctx.answerCbQuery('╨Ч╨░╨┐╨╕╤Б╤М ╤Г╤Б╨┐╨╡╤И╨╜╨╛ ╨╛╤В╨╝╨╡╨╜╨╡╨╜╨░');
        } catch (answerError) {
          // Ignore answer callback errors (e.g., query too old)
          console.log('[TELEGRAM BOT] Answer callback query failed (ignoring):', answerError.message);
        }

        console.log('[BOOKING CANCELLED] Booking ID:', bookingId, 'Chat ID:', chatId);
      } else {
        console.log('[TELEGRAM BOT] Cancel request failed');
        await ctx.answerCbQuery('╨Ю╤И╨╕╨▒╨║╨░ ╨┐╤А╨╕ ╨╛╤В╨╝╨╡╨╜╨╡ ╨╖╨░╨┐╨╕╤Б╨╕', { show_alert: true });
      }
    } else {
      console.log('[TELEGRAM BOT] Unknown callback data:', data);
      await ctx.answerCbQuery();
    }
  } catch (error) {
    console.error('[TELEGRAM BOT] Error handling callback:', error);
    try {
      await ctx.answerCbQuery('╨Я╤А╨╛╨╕╨╖╨╛╤И╨╗╨░ ╨╛╤И╨╕╨▒╨║╨░. ╨Я╨╛╨┐╤А╨╛╨▒╤Г╨╣╤В╨╡ ╨┐╨╛╨╖╨╢╨╡.', { show_alert: true });
    } catch (answerError) {
      console.log('[TELEGRAM BOT] Answer callback query failed in error handler (ignoring):', answerError.message);
    }
  }
});

// Handle other commands
bot.on('message', (ctx) => {
  console.log('[TELEGRAM BOT] Message received:', ctx.message.text);
});

// Function to send booking confirmations (can be called from backend)
async function sendBookingConfirmationMessage(booking, chatId) {
  try {
    // Use startsAtLocal directly as text without any Date conversion
    // Format: 2026-05-27T10:00:00
    const timeToUse = booking.startsAtLocal || booking.startsAt;

    // Format: 2026-05-27T10:00:00 -> 27.05.2026 and 10:00
    const dateStr = timeToUse.replace(
      /(\d{4})-(\d{2})-(\d{2})T.*/,
      '$3.$2.$1'
    );
    const timeStr = timeToUse.replace(
      /.*T(\d{2}):(\d{2}).*/,
      '$1:$2'
    );

    const message = `
тЬЕ ╨Ч╨░╨┐╨╕╤Б╤М ╨┐╨╛╨┤╤В╨▓╨╡╤А╨╢╨┤╨╡╨╜╨░!

ЁЯУЛ ╨г╤Б╨╗╤Г╨│╨░: ${booking.service?.name}
ЁЯСитАНЁЯТ╝ ╨б╨┐╨╡╤Ж╨╕╨░╨╗╨╕╤Б╤В: ${booking.master?.name}
ЁЯУЕ ╨Ф╨░╤В╨░: ${dateStr}
ЁЯХР ╨Т╤А╨╡╨╝╤П: ${timeStr}
ЁЯПв ${booking.business?.name}

╨Ц╨┤╨╡╨╝ ╨▓╨░╤Б!
    `.trim();

    await bot.telegram.sendMessage(chatId, message, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '╨Ю╤В╨╝╨╡╨╜╨╕╤В╤М ╨╖╨░╨┐╨╕╤Б╤М',
              callback_data: `cancel_${booking.id}`
            }
          ],
          [
            {
              text: '╨Я╨╡╤А╨╡╨╖╨░╨┐╨╕╤Б╨░╤В╤М╤Б╤П',
              url: `https://bloknotservis.ru/booking-new.html?slug=${booking.business?.slug}&token=${booking.bookingToken}&reschedule=true`
            }
          ]
        ]
      }
    });
    console.log('[CONFIRMATION SENT] Booking ID:', booking.id, 'Chat ID:', chatId);
  } catch (error) {
    console.error('[TELEGRAM BOT] Error sending confirmation:', error);
    console.error('[TELEGRAM BOT] Error message:', error.message);
    // Don't throw - let the backend continue even if Telegram fails
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
  console.log('тП░ Reminder system started (every hour)');
  
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
  console.log('ЁЯЪА Starting Telegram Bot...');
  console.log('ЁЯУб Mode: Polling');
  console.log('ЁЯФЧ Backend URL: https://bloknotservis.ru');

  // Clear webhook before starting in polling mode
  bot.telegram.deleteWebhook()
    .then(() => {
      console.log('[TELEGRAM BOT] Webhook cleared');
    })
    .catch((error) => {
      console.error('[TELEGRAM BOT] Error clearing webhook:', error);
    });

  // Start health check server
  const express = require('express');
  const healthApp = express();

  healthApp.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  healthApp.listen(8080, () => {
    console.log('ЁЯЪА Health check server listening on port 8080');
  });

  // Start the bot
  startBot();
}
