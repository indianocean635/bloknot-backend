const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.warn('TELEGRAM_BOT_TOKEN not set in environment variables');
}

const bot = token ? new TelegramBot(token, { polling: false }) : null;

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
    await bot.sendMessage(chatId, text);
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
    return await bot.getMe();
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
