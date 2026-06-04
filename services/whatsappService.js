const axios = require('axios');

// Proxy disabled for WhatsApp API requests
// let whatsappProxyConfig = undefined;

// if (process.env.WHATSAPP_PROXY) {
//   try {
//     const proxyUrl = new URL(process.env.WHATSAPP_PROXY);
//     whatsappProxyConfig = {
//       host: proxyUrl.hostname,
//       port: parseInt(proxyUrl.port) || 8080,
//       auth: {
//         username: proxyUrl.username,
//         password: proxyUrl.password
//       },
//       protocol: 'http'
//     };
//     console.log('[WHATSAPP] Dedicated proxy host:', proxyUrl.hostname);
//     console.log('[WHATSAPP] Dedicated proxy port:', proxyUrl.port);
//     console.log('[WHATSAPP] Dedicated proxy user:', proxyUrl.username);
//   } catch (error) {
//     console.error('[WHATSAPP] Error parsing proxy URL:', error.message);
//   }
// }

// console.log('[WHATSAPP] Dedicated proxy enabled:', !!whatsappProxyConfig);

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
 * Send WhatsApp message using WhatsApp Cloud API
 * @param {string} phone - Phone number to send message to
 * @param {string} text - Message text
 * @returns {Promise<void>}
 */
async function sendWhatsAppMessage(phone, text) {
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

    const messageBody = {
      messaging_product: 'whatsapp',
      to: String(normalizedPhone),
      type: 'text',
      text: {
        body: text
      }
    };

    console.log('[WHATSAPP] Sending simple text message');
    console.log('[WHATSAPP] Full request payload:', JSON.stringify(messageBody, null, 2));
    console.log('[WHATSAPP] Phone number type:', typeof messageBody.to);
    console.log('[WHATSAPP] Phone number value:', messageBody.to);

    const axiosConfig = {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    };

    console.log('[WHATSAPP] PROXY OFF');
    console.log({
      proxy: axiosConfig.proxy,
      httpsAgent: !!axiosConfig.httpsAgent
    });

    const response = await axios.post(url, messageBody, axiosConfig);

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

/**
 * Send WhatsApp template message using WhatsApp Cloud API
 * @param {string} phone - Phone number to send message to
 * @param {string} templateName - Template name (e.g., 'booking_confirmation')
 * @param {string} language - Template language code (e.g., 'ru')
 * @param {Object} variables - Template variables object
 * @param {Array} buttons - Array of button objects with sub_type and payload
 * @returns {Promise<void>}
 */
async function sendWhatsAppTemplateMessage(phone, templateName, language, variables = {}, buttons = []) {
  console.log('[WHATSAPP TEMPLATE] START SEND - Phone:', phone, 'Template:', templateName, 'Language:', language, 'Buttons:', buttons);
  
  // Check if WhatsApp is enabled
  if (process.env.WHATSAPP_ENABLED !== 'true') {
    console.log('[WHATSAPP TEMPLATE] SKIPPED - WhatsApp notifications are disabled (WHATSAPP_ENABLED !== true)');
    return;
  }

  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  console.log('[WHATSAPP TEMPLATE] WHATSAPP_TOKEN set:', !!token);
  console.log('[WHATSAPP TEMPLATE] WHATSAPP_PHONE_NUMBER_ID:', phoneNumberId);

  if (!token || !phoneNumberId) {
    console.warn('[WHATSAPP TEMPLATE] SKIPPED - WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set in environment variables');
    return;
  }

  // Normalize phone number
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    console.warn('[WHATSAPP TEMPLATE] SKIPPED - Invalid phone number provided');
    return;
  }

  try {
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    console.log('[WHATSAPP TEMPLATE] Sending to URL:', url);

    console.log(
      '[WHATSAPP INPUT]',
      JSON.stringify({
        phone,
        templateName,
        language,
        variables
      }, null, 2)
    );

    // Build template message body
    const body = {
      messaging_product: 'whatsapp',
      to: String(normalizedPhone),
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: language
        },
        components: []
      }
    };

    // Build body parameters
    const bodyParams = Object.values(variables || {})
      .filter(v => v !== undefined && v !== null && String(v).trim() !== '')
      .map(v => ({
        type: 'text',
        text: String(v)
      }));

    // Add body component
    body.template.components.push({
      type: 'body',
      parameters: bodyParams
    });

    console.log(
      '[WHATSAPP TEMPLATE] Final components:',
      JSON.stringify(body.template.components, null, 2)
    );

    console.log(
      '[WHATSAPP TEMPLATE PAYLOAD FULL]',
      JSON.stringify(body, null, 2)
    );

    console.log(
      '[WHATSAPP TEMPLATE VARIABLES]',
      JSON.stringify(variables, null, 2)
    );

    console.log(
      '[WHATSAPP TEMPLATE META]',
      JSON.stringify({
        templateName,
        language,
        phone: normalizedPhone
      }, null, 2)
    );

    console.log('[WHATSAPP TEMPLATE] Phone number type:', typeof body.to);
    console.log('[WHATSAPP TEMPLATE] Phone number value:', body.to);

    const axiosConfig = {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    };

    console.log('[WHATSAPP TEMPLATE] PROXY OFF');
    console.log({
      proxy: axiosConfig.proxy,
      httpsAgent: !!axiosConfig.httpsAgent
    });

    const response = await axios.post(url, body, axiosConfig);

    console.log(
      '[WHATSAPP TEMPLATE RESPONSE]',
      JSON.stringify(response.data, null, 2)
    );

    console.log('[WHATSAPP TEMPLATE] Template message sent successfully to:', normalizedPhone);
    console.log('[WHATSAPP TEMPLATE] Response status:', response.status);
    console.log('[WHATSAPP TEMPLATE] Response headers:', response.headers);
    console.log('[WHATSAPP TEMPLATE] Response data:', JSON.stringify(response.data, null, 2));
    console.log('[WHATSAPP TEMPLATE] END SEND - Success');
  } catch (err) {
    console.error(
      '[WHATSAPP TEMPLATE ERROR]',
      JSON.stringify({
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
        stack: err.stack
      }, null, 2)
    );

    throw err;
  }
}

module.exports = {
  sendWhatsAppMessage,
  sendWhatsAppTemplateMessage,
  normalizePhone
};
