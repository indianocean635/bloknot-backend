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

  if (!clientId || !clientSecret) {
    throw new Error('VK_APP_ID or VK_CLIENT_SECRET not configured');
  }

  const response = await axios.post('https://oauth.vk.com/access_token', null, {
    params: {
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code: code
    }
  });

  return response.data;
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
    const { code, device_id, state } = req.query;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    const redirectUri = `${process.env.FRONTEND_URL || 'https://bloknotservis.ru'}/auth/vk/callback`;

    // Exchange code for access token
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

    const redirectUri = `${process.env.FRONTEND_URL || 'https://bloknotservis.ru'}/auth/vk/callback`;

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
  getVKStatus
};
