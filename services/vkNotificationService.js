const axios = require('axios');

/**
 * VK Notification Service
 * Handles sending messages to VK users via VK API
 */

/**
 * Send message to VK user
 * @param {string} vkUserId - VK user ID
 * @param {string} message - Message text
 * @param {Object} variables - Template variables
 * @returns {Promise<void>}
 */
async function sendVKMessage(vkUserId, message, variables = {}) {
  console.log('[VK NOTIFICATION] START SEND - VK User ID:', vkUserId);
  
  // Check if VK notifications are enabled
  if (process.env.VK_NOTIFICATIONS_ENABLED !== 'true') {
    console.log('[VK NOTIFICATION] SKIPPED - VK notifications are disabled (VK_NOTIFICATIONS_ENABLED !== true)');
    return;
  }

  const communityToken = process.env.VK_COMMUNITY_TOKEN;
  const apiVersion = process.env.VK_API_VERSION || '5.199';

  console.log('[VK NOTIFICATION] VK_COMMUNITY_TOKEN set:', !!communityToken);
  console.log('[VK NOTIFICATION] VK_API_VERSION:', apiVersion);

  if (!communityToken) {
    console.warn('[VK NOTIFICATION] SKIPPED - VK_COMMUNITY_TOKEN not set in environment variables');
    return;
  }

  if (!vkUserId) {
    console.warn('[VK NOTIFICATION] SKIPPED - VK user ID not provided');
    return;
  }

  // Replace variables in message
  let formattedMessage = message;
  Object.entries(variables).forEach(([key, value]) => {
    formattedMessage = formattedMessage.replace(new RegExp(`{${key}}`, 'g'), value || '');
  });

  console.log('[VK NOTIFICATION] Formatted message:', formattedMessage);
  console.log('[VK NOTIFICATION] VK User ID:', vkUserId);

  try {
    const response = await axios.post('https://api.vk.com/method/messages.send', null, {
      params: {
        access_token: communityToken,
        v: apiVersion,
        user_id: vkUserId,
        message: formattedMessage,
        random_id: Math.floor(Math.random() * 1000000)
      }
    });

    console.log('[VK NOTIFICATION] Response status:', response.status);
    console.log('[VK NOTIFICATION] Response data:', JSON.stringify(response.data, null, 2));

    if (response.data.error) {
      console.error('[VK NOTIFICATION ERROR] VK API Error:', response.data.error);
      throw new Error(`VK API Error: ${response.data.error.error_msg}`);
    }

    console.log('[VK NOTIFICATION] ✅ Message sent successfully to VK user:', vkUserId);
  } catch (err) {
    console.error('[VK NOTIFICATION ERROR] Status:', err.response?.status);
    console.error('[VK NOTIFICATION ERROR] Status Text:', err.response?.statusText);
    console.error('[VK NOTIFICATION ERROR] Error Data:', JSON.stringify(err.response?.data, null, 2));
    console.error('[VK NOTIFICATION ERROR] Error Message:', err.message);
    console.error('[VK NOTIFICATION ERROR] Full Error:', JSON.stringify({
      status: err.response?.status,
      data: err.response?.data,
      message: err.message,
      stack: err.stack
    }, null, 2));

    // Log specific error details from VK API
    if (err.response?.data?.error) {
      console.error('[VK NOTIFICATION ERROR] VK API Error Code:', err.response.data.error.error_code);
      console.error('[VK NOTIFICATION ERROR] VK API Error Message:', err.response.data.error.error_msg);
    }

    throw err;
  }
}

/**
 * Send booking confirmation message
 * @param {string} vkUserId - VK user ID
 * @param {Object} variables - Template variables
 * @returns {Promise<void>}
 */
async function sendBookingConfirmation(vkUserId, variables) {
  const message = `Здравствуйте, {customer_name}!

Ваша запись подтверждена ✅

📅 Дата: {date}
🕒 Время: {time}
👩 Специалист: {specialist}
✂️ Услуга: {service}

🔄 Перезаписаться:
{booking_link}`;

  console.log('[VK NOTIFICATION] Sending booking confirmation to VK user:', vkUserId);
  console.log('[VK NOTIFICATION] Variables:', JSON.stringify(variables, null, 2));
  
  await sendVKMessage(vkUserId, message, variables);
}

/**
 * Send 24h reminder message
 * @param {string} vkUserId - VK user ID
 * @param {Object} variables - Template variables
 * @returns {Promise<void>}
 */
async function sendReminder24h(vkUserId, variables) {
  const message = `Здравствуйте, {customer_name}!

Напоминаем, что у вас запись завтра ✅

📅 Дата: {date}
🕒 Время: {time}
👩 Специалист: {specialist}
✂️ Услуга: {service}

🔄 Перезаписаться:
{booking_link}`;

  console.log('[VK NOTIFICATION] Sending 24h reminder to VK user:', vkUserId);
  await sendVKMessage(vkUserId, message, variables);
}

/**
 * Send 1h reminder message
 * @param {string} vkUserId - VK user ID
 * @param {Object} variables - Template variables
 * @returns {Promise<void>}
 */
async function sendReminder1h(vkUserId, variables) {
  const message = `Здравствуйте, {customer_name}!

Напоминаем, что ваша запись через час ✅

📅 Дата: {date}
🕒 Время: {time}
👩 Специалист: {specialist}
✂️ Услуга: {service}

🔄 Перезаписаться:
{booking_link}`;

  console.log('[VK NOTIFICATION] Sending 1h reminder to VK user:', vkUserId);
  await sendVKMessage(vkUserId, message, variables);
}

/**
 * Send cancellation message
 * @param {string} vkUserId - VK user ID
 * @param {Object} variables - Template variables
 * @returns {Promise<void>}
 */
async function sendCancellation(vkUserId, variables) {
  const message = `Здравствуйте, {customer_name}!

Ваша запись была отменена ❌

📅 Дата: {date}
🕒 Время: {time}
👩 Специалист: {specialist}
✂️ Услуга: {service}

🔄 Записаться снова:
{booking_link}`;

  console.log('[VK NOTIFICATION] Sending cancellation to VK user:', vkUserId);
  await sendVKMessage(vkUserId, message, variables);
}

/**
 * Send reschedule message
 * @param {string} vkUserId - VK user ID
 * @param {Object} variables - Template variables
 * @returns {Promise<void>}
 */
async function sendReschedule(vkUserId, variables) {
  const message = `Здравствуйте, {customer_name}!

Ваша запись была перенесена ✅

📅 Новая дата: {date}
🕒 Новое время: {time}
👩 Специалист: {specialist}
✂️ Услуга: {service}

🔄 Перезаписаться:
{booking_link}`;

  console.log('[VK NOTIFICATION] Sending reschedule to VK user:', vkUserId);
  await sendVKMessage(vkUserId, message, variables);
}

module.exports = {
  sendVKMessage,
  sendBookingConfirmation,
  sendReminder24h,
  sendReminder1h,
  sendCancellation,
  sendReschedule
};
