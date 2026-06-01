const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

// Configure proxy agent for WhatsApp API requests
const proxyAgent = process.env.HTTPS_PROXY
  ? new HttpsProxyAgent(process.env.HTTPS_PROXY)
  : undefined;

console.log('[WHATSAPP] Proxy agent enabled:', !!proxyAgent);

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
  
  // Remove all non-digit characters
  let normalized = phone.replace(/\D/g, '');
  
  console.log('[WHATSAPP] Original phone:', phone);
  console.log('[WHATSAPP] Normalized phone (digits only):', normalized);
  
  // Handle Russian numbers starting with 8 (convert to 7)
  if (normalized.startsWith('8')) {
    normalized = '7' + normalized.substring(1);
    console.log('[WHATSAPP] Converted 8 to 7, final phone:', normalized);
  }
  // If it doesn't start with country code (assuming Russia +7 by default)
  else if (!normalized.startsWith('7') && !normalized.startsWith('1') && !normalized.startsWith('44')) {
    // Default to Russia if no country code
    normalized = '7' + normalized;
    console.log('[WHATSAPP] Added country code, final phone:', normalized);
  }
  
  // Validate phone length (should be 11-15 digits for international numbers)
  if (normalized.length < 10 || normalized.length > 15) {
    console.warn('[WHATSAPP] Invalid phone length:', normalized.length);
    return null;
  }
  
  console.log('[WHATSAPP] Final normalized phone:', normalized);
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
  console.log('[WHATSAPP] START SEND - Phone:', phone);
  
  // Check if WhatsApp is enabled
  if (process.env.WHATSAPP_ENABLED !== 'true') {
    console.log('[WHATSAPP] SKIPPED - WhatsApp notifications are disabled (WHATSAPP_ENABLED !== true)');
    return;
  }

  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  console.log('[WHATSAPP] WHATSAPP_TOKEN set:', !!token);
  console.log('[WHATSAPP] WHATSAPP_PHONE_NUMBER_ID:', phoneNumberId);

  if (!token || !phoneNumberId) {
    console.warn('[WHATSAPP] SKIPPED - WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set in environment variables');
    return;
  }

  // Normalize phone number
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    console.warn('[WHATSAPP] SKIPPED - Invalid phone number provided');
    return;
  }

  try {
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    console.log('[WHATSAPP] Sending to URL:', url);
    
    let messageBody;
    
    if (buttons && buttons.length > 0) {
      // Send message with interactive buttons
      messageBody = {
        messaging_product: 'whatsapp',
        to: String(normalizedPhone),
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
      console.log('[WHATSAPP] Sending interactive message with buttons:', buttons.map(b => b.title));
    } else {
      // Send simple text message
      messageBody = {
        messaging_product: 'whatsapp',
        to: String(normalizedPhone),
        type: 'text',
        text: {
          body: text
        }
      };
      console.log('[WHATSAPP] Sending simple text message');
    }
    
    console.log('[WHATSAPP] Full request payload:', JSON.stringify(messageBody, null, 2));
    console.log('[WHATSAPP] Phone number type:', typeof messageBody.to);
    console.log('[WHATSAPP] Phone number value:', messageBody.to);
    console.log('[WHATSAPP] Sending WITHOUT proxy');
    
    const response = await axios.post(url, messageBody, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      proxy: false,
      timeout: 20000
    });

    console.log('[WHATSAPP] Message sent successfully to:', normalizedPhone);
    console.log('[WHATSAPP] Response status:', response.status);
    console.log('[WHATSAPP] Response headers:', response.headers);
    console.log('[WHATSAPP] Response data:', JSON.stringify(response.data, null, 2));
    console.log('[WHATSAPP] END SEND - Success');
  } catch (error) {
    console.error('[WHATSAPP] END SEND - Error');
    console.error('[WHATSAPP] Error status:', error.response?.status);
    console.error('[WHATSAPP] Error status text:', error.response?.statusText);
    console.error('[WHATSAPP] Error headers:', error.response?.headers);
    console.error('[WHATSAPP] Error data (raw):', error.response?.data);
    console.error('[WHATSAPP] Error data (stringified):', JSON.stringify(error.response?.data, null, 2));
    console.error('[WHATSAPP] Error message:', error.message);
    console.error('[WHATSAPP] Error config:', {
      url: error.config?.url,
      method: error.config?.method,
      headers: error.config?.headers
    });
    // Don't throw - let the calling function handle the error gracefully
  }
}

module.exports = {
  sendWhatsAppMessage,
  normalizePhone
};
