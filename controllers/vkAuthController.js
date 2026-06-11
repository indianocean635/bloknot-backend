const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * VK Auth Controller
 * Handles VK ID authentication
 */

/**
 * Exchange VK code for access token and get user info
 * @param {string} code - VK authorization code
 * @param {string} redirectUri - Redirect URI used in authorization
 * @returns {Promise<Object>} User info with access token
 */
async function exchangeCodeForToken(code, redirectUri) {
  const clientId = process.env.VK_APP_ID;
  const clientSecret = process.env.VK_CLIENT_SECRET;

  console.log('[VK TOKEN EXCHANGE] Starting token exchange...');
  console.log('[VK TOKEN EXCHANGE] client_id:', clientId);
  console.log('[VK TOKEN EXCHANGE] client_secret:', clientSecret ? 'present' : 'missing');
  console.log('[VK TOKEN EXCHANGE] redirect_uri:', redirectUri);
  console.log('[VK TOKEN EXCHANGE] code:', code ? 'present' : 'missing');

  if (!clientId || !clientSecret) {
    console.error('[VK TOKEN EXCHANGE] Missing VK_APP_ID or VK_CLIENT_SECRET');
    throw new Error('VK_APP_ID or VK_CLIENT_SECRET not configured');
  }

  const tokenUrl = 'https://oauth.vk.com/access_token';
  const params = {
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code: code
  };

  console.log('[VK TOKEN EXCHANGE] Request URL:', tokenUrl);
  console.log('[VK TOKEN EXCHANGE] Request params:', {
    ...params,
    client_secret: clientSecret ? '***hidden***' : 'missing'
  });

  try {
    const response = await axios.post(tokenUrl, null, { params });
    
    console.log('[VK TOKEN EXCHANGE] Response status:', response.status);
    console.log('[VK TOKEN EXCHANGE] Response data:', {
      access_token: response.data.access_token ? 'present' : 'missing',
      expires_in: response.data.expires_in,
      user_id: response.data.user_id,
      email: response.data.email
    });

    if (response.data.error) {
      console.error('[VK TOKEN EXCHANGE] VK API error:', response.data.error, response.data.error_description);
      throw new Error(`VK API Error: ${response.data.error} - ${response.data.error_description}`);
    }

    return response.data;
  } catch (error) {
    console.error('[VK TOKEN EXCHANGE] Request failed:', error.message);
    if (error.response) {
      console.error('[VK TOKEN EXCHANGE] Error response:', {
        status: error.response.status,
        data: error.response.data
      });
    }
    throw error;
  }
}

async function exchangeCodeForTokenWithPKCE(code, redirectUri, codeVerifier) {
  const clientId = process.env.VK_APP_ID;
  const clientSecret = process.env.VK_CLIENT_SECRET;

  console.log('[VK TOKEN EXCHANGE PKCE] Starting PKCE token exchange...');
  console.log('[VK TOKEN EXCHANGE PKCE] client_id:', clientId);
  console.log('[VK TOKEN EXCHANGE PKCE] client_secret:', clientSecret ? 'present' : 'missing');
  console.log('[VK TOKEN EXCHANGE PKCE] redirect_uri:', redirectUri);
  console.log('[VK TOKEN EXCHANGE PKCE] code:', code ? 'present' : 'missing');
  console.log('[VK TOKEN EXCHANGE PKCE] code_verifier:', codeVerifier ? 'present' : 'missing');
  console.log('[VK TOKEN EXCHANGE PKCE] code_verifier length:', codeVerifier ? codeVerifier.length : 0);

  if (!clientId || !clientSecret) {
    console.error('[VK TOKEN EXCHANGE PKCE] Missing VK_APP_ID or VK_CLIENT_SECRET');
    throw new Error('VK_APP_ID or VK_CLIENT_SECRET not configured');
  }

  if (!codeVerifier) {
    console.error('[VK TOKEN EXCHANGE PKCE] Missing code verifier');
    throw new Error('Code verifier is required for PKCE');
  }

  const tokenUrl = 'https://oauth.vk.com/access_token';
  const params = {
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code: code,
    code_verifier: codeVerifier  // PKCE parameter
  };

  console.log('[VK TOKEN EXCHANGE PKCE] Request URL:', tokenUrl);
  console.log('[VK TOKEN EXCHANGE PKCE] Request params:', {
    client_id: params.client_id,
    client_secret: params.client_secret ? '***hidden***' : 'missing',
    redirect_uri: params.redirect_uri,
    code: params.code ? 'present' : 'missing',
    code_verifier: params.code_verifier ? 'present' : 'missing'
  });

  try {
    const response = await axios.post(tokenUrl, null, { params });
    
    console.log('[VK TOKEN EXCHANGE PKCE] Response status:', response.status);
    console.log('[VK TOKEN EXCHANGE PKCE] Response data:', {
      access_token: response.data.access_token ? 'present' : 'missing',
      expires_in: response.data.expires_in,
      user_id: response.data.user_id,
      email: response.data.email
    });

    if (response.data.error) {
      console.error('[VK TOKEN EXCHANGE PKCE] VK API error:', response.data.error, response.data.error_description);
      throw new Error(`VK API Error: ${response.data.error} - ${response.data.error_description}`);
    }

    return response.data;
  } catch (error) {
    console.error('[VK TOKEN EXCHANGE PKCE] Request failed:', error.message);
    if (error.response) {
      console.error('[VK TOKEN EXCHANGE PKCE] Error response:', {
        status: error.response.status,
        data: error.response.data
      });
    }
    throw error;
  }
}

/**
 * Get VK user info
 * @param {string} accessToken - VK access token
 * @param {string} userId - VK user ID
 * @returns {Promise<Object>} User info
 */
async function getVKUserInfo(accessToken, userId) {
  const response = await axios.get('https://api.vk.com/method/users.get', {
    params: {
      access_token: accessToken,
      user_ids: userId,
      fields: 'first_name,last_name,photo_200',
      v: '5.199'
    }
  });

  if (response.data.error) {
    throw new Error(`VK API Error: ${response.data.error.error_msg}`);
  }

  return response.data.response[0];
}

/**
 * Handle VK ID authorization callback
 */
async function vkAuthCallback(req, res) {
  try {
    console.log('[VK CALLBACK REQUEST] Full request query:', req.query);
    console.log('[VK CALLBACK REQUEST] Headers:', req.headers);
    
    const { code, device_id, state, error, error_description } = req.query;

    console.log('[VK CALLBACK] Parameters:');
    console.log('  - code:', code ? 'present' : 'missing');
    console.log('  - device_id:', device_id);
    console.log('  - state:', state);
    console.log('  - error:', error);
    console.log('  - error_description:', error_description);

    // Check for OAuth errors from VK
    if (error) {
      console.error('[VK CALLBACK] VK returned OAuth error:', error, error_description);
      const frontendUrl = process.env.FRONTEND_URL || 'https://bloknotservis.ru';
      return res.redirect(`${frontendUrl}/auth/vk/error?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(error_description || '')}&state=${state || ''}`);
    }

    if (!code) {
      console.error('[VK CALLBACK] No authorization code received');
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    const redirectUri = `${process.env.FRONTEND_URL || 'https://bloknotservis.ru'}/api/vk/callback`;
    console.log('[VK CALLBACK] Using redirect URI for token exchange:', redirectUri);

    // Exchange code for access token
    console.log('[VK CALLBACK] Exchanging code for access token...');
    const tokenData = await exchangeCodeForToken(code, redirectUri);
    
    console.log('[VK AUTH] Token data received:', {
      user_id: tokenData.user_id,
      access_token: !!tokenData.access_token
    });

    // Get user info
    const userInfo = await getVKUserInfo(tokenData.access_token, tokenData.user_id);
    
    console.log('[VK AUTH] User info received:', {
      id: userInfo.id,
      first_name: userInfo.first_name,
      last_name: userInfo.last_name
    });

    // Check if user exists by VK ID
    let user = await prisma.user.findFirst({
      where: {
        email: `vk_${tokenData.user_id}@vk.com`
      }
    });

    if (user) {
      // Update existing user
      console.log('[VK AUTH] Existing user found:', user.id);
    } else {
      // Create new user
      user = await prisma.user.create({
        data: {
          email: `vk_${tokenData.user_id}@vk.com`,
          name: `${userInfo.first_name} ${userInfo.last_name}`,
          role: 'OWNER'
        }
      });
      console.log('[VK AUTH] New user created:', user.id);
    }

    // Create session token
    const jwt = require('jsonwebtoken');
    const sessionToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '90d' }
    );

    // Redirect to frontend with token
    const frontendUrl = process.env.FRONTEND_URL || 'https://bloknotservis.ru';
    res.redirect(`${frontendUrl}/auth/vk/success?token=${sessionToken}&vk_user_id=${tokenData.user_id}`);
  } catch (error) {
    console.error('[VK AUTH] Error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'https://bloknotservis.ru';
    res.redirect(`${frontendUrl}/auth/vk/error?message=${encodeURIComponent(error.message)}`);
  }
}

/**
 * Link VK account to existing user
 */
async function linkVKAccount(req, res) {
  try {
    const { code } = req.body;
    const userId = req.user.id; // From auth middleware

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    const redirectUri = `${process.env.FRONTEND_URL || 'https://bloknotservis.ru'}/api/vk/callback`;

    // Exchange code for access token
    const tokenData = await exchangeCodeForToken(code, redirectUri);
    
    console.log('[VK LINK] Token data received:', {
      user_id: tokenData.user_id,
      access_token: !!tokenData.access_token
    });

    // Get user info
    const userInfo = await getVKUserInfo(tokenData.access_token, tokenData.user_id);
    
    console.log('[VK LINK] User info received:', {
      id: userInfo.id,
      first_name: userInfo.first_name,
      last_name: userInfo.last_name
    });

    // Update user's email to include VK ID (or store in a separate field if needed)
    // For now, we'll store VK ID in a custom way
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name: `${userInfo.first_name} ${userInfo.last_name}`
      }
    });

    console.log('[VK LINK] User updated:', updatedUser.id);

    res.json({ 
      success: true, 
      vk_user_id: tokenData.user_id,
      user: updatedUser
    });
  } catch (error) {
    console.error('[VK LINK] Error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Unlink VK account
 */
async function unlinkVKAccount(req, res) {
  try {
    const userId = req.user.id;

    // Reset user name (or remove VK ID from wherever it's stored)
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name: null
      }
    });

    console.log('[VK UNLINK] User updated:', updatedUser.id);

    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('[VK UNLINK] Error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get VK connection status
 */
async function getVKStatus(req, res) {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    // Check if user has VK connected (based on email pattern or name)
    const isVkConnected = user.email.startsWith('vk_') && user.email.endsWith('@vk.com');

    res.json({ 
      isVkConnected,
      vkUserId: isVkConnected ? user.email.replace('vk_', '').replace('@vk.com', '') : null
    });
  } catch (error) {
    console.error('[VK STATUS] Error:', error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  vkAuthCallback,
  linkVKAccount,
  unlinkVKAccount,
  getVKStatus,
  exchangeCodeForToken,
  exchangeCodeForTokenWithPKCE
};
