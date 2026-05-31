const axios = require('axios');

/**
 * Normalize phone number to international format
 * - Remove + prefix
 * - Remove spaces
 * - Ensure it starts with country code
 * @param {string} phone - Phone number to normalize
 * @returns {string} Normalized phone number
 */
function normalizePhone(phone) {
  if (!phone) return null;
  
  // Remove + and spaces
  let normalized = phone.replace(/\+/g, '').replace(/\s/g, '');
  
  // If it doesn't start with country code (assuming Russia +7 by default)
  // You can adjust this logic based on your needs
  if (!normalized.startsWith('7') && !normalized.startsWith('1') && !normalized.startsWith('44')) {
    // Default to Russia if no country code
    normalized = '7' + normalized;
  }
  
  return normalized;
}

/**
 * Send WhatsApp message with interactive buttons using WhatsApp Cloud API
 * @param {string} phone - Phone number to send message to
 * @param {string} text - Message text
 * @param {Array} buttons - Array of button objects [{id, title}]
 * @returns {Promise<void>}
 */
async function sendWhatsAppMessage(phone, text, buttons = null) {
  // Check if WhatsApp is enabled
  if (process.env.WHATSAPP_ENABLED !== 'true') {
    console.log('[WHATSAPP] WhatsApp notifications are disabled (WHATSAPP_ENABLED !== true)');
    return;
  }

  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.warn('[WHATSAPP] WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set in environment variables');
    return;
  }

  // Normalize phone number
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    console.warn('[WHATSAPP] Invalid phone number provided');
    return;
  }

  try {
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    
    let messageBody;
    
    if (buttons && buttons.length > 0) {
      // Send message with interactive buttons
      messageBody = {
        messaging_product: 'whatsapp',
        to: normalizedPhone,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: text
          },
          action: {
            buttons: buttons.map(btn => ({
              type: 'reply',
              reply: {
                id: btn.id,
                title: btn.title
              }
            }))
          }
        }
      };
    } else {
      // Send simple text message
      messageBody = {
        messaging_product: 'whatsapp',
        to: normalizedPhone,
        type: 'text',
        text: {
          body: text
        }
      };
    }
    
    const response = await axios.post(url, messageBody, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('[WHATSAPP] Message sent successfully to:', normalizedPhone);
    console.log('[WHATSAPP] Response:', response.data);
  } catch (error) {
    console.error('[WHATSAPP] Error sending message:', error.response?.data || error.message);
    // Don't throw - let the calling function handle the error gracefully
  }
}

module.exports = {
  sendWhatsAppMessage,
  normalizePhone
};
