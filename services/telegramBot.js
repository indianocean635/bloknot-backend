const { Telegraf } = require('telegraf');
require('dotenv').config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

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
    const response = await fetch('https://bloknotservis.ru/api/telegram/connect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token: payload,
        chatId: ctx.chat.id,
        username: ctx.from.username
      })
    });

    if (response.ok) {
      await ctx.reply('Telegram успешно подключен ✅\n\nТеперь вы будете получать уведомления о записях.');
    } else {
      await ctx.reply('Ошибка подключения. Недействительный токен.');
    }
  } catch (error) {
    console.error('[TELEGRAM BOT] Error connecting:', error);
    await ctx.reply('Ошибка подключения. Попробуйте позже.');
  }
});

// Handle other commands
bot.on('message', (ctx) => {
  console.log('[TELEGRAM BOT] Message received:', ctx.message.text);
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Launch bot
bot.launch()
  .then(() => {
    console.log('[TELEGRAM BOT] Bot started successfully');
  })
  .catch((error) => {
    console.error('[TELEGRAM BOT] Error starting bot:', error);
    process.exit(1);
  });

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

module.exports = { bot };
