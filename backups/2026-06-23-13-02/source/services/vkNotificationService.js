const axios = require('axios');

/**
 * VK Notification Service
 * Handles sending messages to VK users via VK Community API
 */

/**
 * Send message to VK user via community
 * @param {string} vkUserId - VK user ID
 * @param {string} message - Message text
 * @param {Object} variables - Template variables
 * @returns {Promise<void>}
 */
async function sendVKMessage(vkUserId, message, variables = {}) {
  console.log('[VK SEND] START - VK User ID:', vkUserId);
  
  // Check if VK notifications are enabled
  if (process.env.VK_NOTIFICATIONS_ENABLED !== 'true') {
    console.log('[VK SEND] SKIPPED - VK notifications are disabled (VK_NOTIFICATIONS_ENABLED !== true)');
    return;
  }

  const accessToken = process.env.VK_ACCESS_TOKEN;
  const groupId = process.env.VK_GROUP_ID;
  const apiVersion = process.env.VK_API_VERSION || '5.199';

  console.log('[VK SEND] VK_ACCESS_TOKEN set:', !!accessToken);
  console.log('[VK SEND] VK_GROUP_ID:', groupId);
  console.log('[VK SEND] VK_API_VERSION:', apiVersion);

  if (!accessToken) {
    console.warn('[VK SEND] SKIPPED - VK_ACCESS_TOKEN not set in environment variables');
    return;
  }

  if (!groupId) {
    console.warn('[VK SEND] SKIPPED - VK_GROUP_ID not set in environment variables');
    return;
  }

  if (!vkUserId) {
    console.warn('[VK SEND] SKIPPED - VK user ID not provided');
    return;
  }

  // Replace variables in message
  let formattedMessage = message;
  Object.entries(variables).forEach(([key, value]) => {
    formattedMessage = formattedMessage.replace(new RegExp(`{${key}}`, 'g'), value || '');
  });

  console.log('[VK SEND] Formatted message:', formattedMessage);
  console.log('[VK SEND] VK User ID:', vkUserId);

  try {
    const response = await axios.post('https://api.vk.com/method/messages.send', null, {
      params: {
        access_token: accessToken,
        v: apiVersion,
        group_id: groupId,
        user_id: vkUserId,
        message: formattedMessage,
        random_id: Math.floor(Math.random() * 1000000000)
      }
    });

    console.log('[VK SEND] Response status:', response.status);
    console.log('[VK SEND] Response data:', JSON.stringify(response.data, null, 2));

    if (response.data.error) {
      console.error('[VK ERROR] VK API Error:', response.data.error);
      throw new Error(`VK API Error: ${response.data.error.error_msg}`);
    }

    console.log('[VK SUCCESS] ✅ Message sent successfully to VK user:', vkUserId);
  } catch (err) {
    console.error('[VK ERROR] Status:', err.response?.status);
    console.error('[VK ERROR] Status Text:', err.response?.statusText);
    console.error('[VK ERROR] Error Data:', JSON.stringify(err.response?.data, null, 2));
    console.error('[VK ERROR] Error Message:', err.message);
    console.error('[VK ERROR] Full Error:', JSON.stringify({
      status: err.response?.status,
      data: err.response?.data,
      message: err.message,
      stack: err.stack
    }, null, 2));

    // Log specific error details from VK API
    if (err.response?.data?.error) {
      console.error('[VK ERROR] VK API Error Code:', err.response.data.error.error_code);
      console.error('[VK ERROR] VK API Error Message:', err.response.data.error.error_msg);
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
  const message = `Ваша запись подтверждена ✅

📅 Дата: {date}
🕒 Время: {time}
👩 Специалист: {specialist}
✂️ Услуга: {service}

🔄 Перезаписаться:
{booking_link}

Ждём вас ❤️`;

  console.log('[VK SEND] Sending booking confirmation to VK user:', vkUserId);
  console.log('[VK SEND] Variables:', JSON.stringify(variables, null, 2));
  
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

  console.log('[VK SEND] Sending 24h reminder to VK user:', vkUserId);
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

  console.log('[VK SEND] Sending 1h reminder to VK user:', vkUserId);
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

  console.log('[VK SEND] Sending cancellation to VK user:', vkUserId);
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

  console.log('[VK SEND] Sending reschedule to VK user:', vkUserId);
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
