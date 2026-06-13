const { Telegraf } = require('telegraf');
const { HttpsProxyAgent } = require('https-proxy-agent');

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.warn('TELEGRAM_BOT_TOKEN not set in environment variables');
}

// Use proxy if configured
const proxyAgent = process.env.HTTPS_PROXY
  ? new HttpsProxyAgent(process.env.HTTPS_PROXY)
  : undefined;

console.log('[TELEGRAM LIB] Proxy agent enabled:', !!proxyAgent);

const bot = token ? new Telegraf(token, {
  telegram: {
    agent: proxyAgent
  }
}) : null;

/**
 * Send a message to a Telegram chat
 * @param {string} chatId - The chat ID to send the message to
 * @param {string} text - The message text
 * @returns {Promise<void>}
 */
async function sendTelegramMessage(chatId, text) {
  if (!bot) {
    console.warn('Telegram bot not initialized');
    return;
  }

  try {
    await bot.telegram.sendMessage(chatId, text);
    console.log(`Telegram message sent to ${chatId}`);
  } catch (error) {
    console.error('Error sending Telegram message:', error);
  }
}

/**
 * Get bot info
 * @returns {Promise<object|null>}
 */
async function getBotInfo() {
  if (!bot) {
    return null;
  }

  try {
    return await bot.telegram.getMe();
  } catch (error) {
    console.error('Error getting bot info:', error);
    return null;
  }
}

module.exports = {
  bot,
  sendTelegramMessage,
  getBotInfo
};
