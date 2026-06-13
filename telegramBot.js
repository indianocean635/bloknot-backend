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

// Handle /start command with payload (deep-link)
bot.start(async (ctx) => {
  const payload = ctx.startPayload;
  
  console.log('[TELEGRAM BOT] Start command received with payload:', payload);
  
  if (payload) {
    // Handle deep-link payload (e.g., magic link token)
    try {
      // Here you can handle the payload for authentication
      await ctx.reply('🔗 Получена ссылка для авторизации. Обработка...');
      
      // You can add logic to handle the payload
      // For example, validate token and authenticate user
      
    } catch (error) {
      console.error('[TELEGRAM BOT] Error handling payload:', error);
      await ctx.reply('❌ Ошибка обработки ссылки. Попробуйте позже.');
    }
  } else {
    await ctx.reply('👋 Добро пожаловать в Bloknot Bot!\n\nИспользуйте /help для просмотра команд.');
  }
});

// Handle /help command
bot.help(async (ctx) => {
  await ctx.reply(`
📋 *Доступные команды:*

/start - Запустить бота
/help - Показать это сообщение
/status - Проверить статус подписки

🔗 *Для авторизации:*
Используйте magic-ссылку из личного кабинета
  `);
});

// Handle /status command
bot.command('status', async (ctx) => {
  try {
    // Here you can check user's subscription status
    await ctx.reply('📊 Функция проверки статуса в разработке...');
  } catch (error) {
    console.error('[TELEGRAM BOT] Error checking status:', error);
    await ctx.reply('❌ Ошибка проверки статуса.');
  }
});

// Handle text messages
bot.on('text', async (ctx) => {
  console.log('[TELEGRAM BOT] Text message received:', ctx.message.text);
  
  // Echo for now, can be extended
  await ctx.reply('📨 Сообщение получено. Используйте /help для просмотра команд.');
});

// Handle errors
bot.catch((err, ctx) => {
  console.error('[TELEGRAM BOT] Error:', err);
  ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
});

// Start bot
console.log('🚀 Starting Telegram Bot...');
console.log('📡 Mode: Polling');
console.log('🔗 Backend URL:', process.env.BASE_URL);

bot.launch()
  .then(() => {
    console.log('✅ Telegram Bot started successfully!');
  })
  .catch((error) => {
    console.error('❌ Failed to start Telegram Bot:', error);
    process.exit(1);
  });

// Graceful shutdown
process.once('SIGINT', () => {
  console.log('[TELEGRAM BOT] Received SIGINT, stopping bot...');
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  console.log('[TELEGRAM BOT] Received SIGTERM, stopping bot...');
  bot.stop('SIGTERM');
});
