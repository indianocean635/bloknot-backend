const express = require('express');
const router = express.Router();
const { 
  vkAuthCallback, 
  linkVKAccount, 
  unlinkVKAccount, 
  getVKStatus 
} = require('../controllers/vkAuthController');
const { sendBookingConfirmation } = require('../services/vkNotificationService');
const { requireMagicAuth } = require('../middleware/magicAuthMiddleware');

// Get VK config (public endpoint)
router.get('/config', (req, res) => {
  res.json({
    appId: process.env.VK_APP_ID || '',
    enabled: process.env.VK_NOTIFICATIONS_ENABLED === 'true'
  });
});

// Debug auth URL endpoint
router.get('/debug/auth-url', (req, res) => {
  const appId = process.env.VK_APP_ID || '';
  const redirectUri = `${process.env.FRONTEND_URL || 'https://bloknotservis.ru'}/auth/vk/callback`;
  const scope = 'openid email';
  const responseType = 'code';
  const state = 'debug-state-' + Date.now();
  const codeChallengeMethod = 'S256';
  
  // Generate sample PKCE
  function generateCodeVerifier(length = 128) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
  
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = codeVerifier.substring(0, 43); // Simplified for debug
  
  const authUrl = `https://id.vk.com/authorize?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${encodeURIComponent(scope)}&code_challenge=${codeChallenge}&code_challenge_method=${codeChallengeMethod}&response_type=${responseType}&prompt=login`;
  
  res.json({
    appId,
    redirectUri,
    scope,
    responseType,
    state,
    codeChallengeMethod,
    authUrl
  });
});

// VK Auth callback GET (direct from VK - for legacy support)
router.get('/callback', vkAuthCallback);

// VK Auth callback POST (from frontend callback page)
router.post('/callback', async (req, res) => {
  try {
    console.log('[VK CALLBACK POST] Request from frontend callback');
    console.log('[VK CALLBACK POST] Request body:', req.body);
    
    const { code, state, device_id, code_verifier } = req.body;
    
    console.log('[PKCE] Backend received code_verifier:', code_verifier ? 'PRESENT' : 'MISSING');
    console.log('[PKCE] Backend code_verifier length:', code_verifier ? code_verifier.length : 0);
    
    if (!code) {
      return res.status(400).json({ 
        success: false, 
        error: 'Authorization code is required' 
      });
    }
    
    if (!code_verifier) {
      return res.status(400).json({ 
        success: false, 
        error: 'Code verifier is required for PKCE' 
      });
    }
    
    const redirectUri = `${process.env.FRONTEND_URL || 'https://bloknotservis.ru'}/auth/vk/callback`;
    console.log('[VK CALLBACK POST] Using redirect URI for token exchange:', redirectUri);
    
    // Exchange code for access token with PKCE
    console.log('[VK CALLBACK POST] Exchanging code for access token with PKCE...');
    const { exchangeCodeForTokenWithPKCE } = require('../controllers/vkAuthController');
    const tokenData = await exchangeCodeForTokenWithPKCE(code, redirectUri, code_verifier);
    
    console.log('[VK CALLBACK POST] Token data received:', {
      user_id: tokenData.user_id,
      access_token: !!tokenData.access_token
    });
    
    // Get user info
    const { getVKUserInfo, createOrUpdateVKUser } = require('../controllers/vkAuthController');
    const userInfo = await getVKUserInfo(tokenData.access_token, tokenData.user_id);
    
    console.log('[VK CALLBACK POST] User info received:', {
      user_id: userInfo.id,
      first_name: userInfo.first_name,
      last_name: userInfo.last_name
    });
    
    // Create or update user and get session token
    const sessionToken = await createOrUpdateVKUser(tokenData.user_id, userInfo, state);
    
    console.log('[VK CALLBACK POST] Session token created');
    
    // Return success to frontend
    res.json({
      success: true,
      token: sessionToken,
      vk_user_id: tokenData.user_id,
      user_info: userInfo
    });
    
  } catch (error) {
    console.error('[VK CALLBACK POST] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Link VK account to existing user (requires auth)
router.post('/link', requireMagicAuth, linkVKAccount);

// Unlink VK account (requires auth)
router.post('/unlink', requireMagicAuth, unlinkVKAccount);

// Get VK connection status (requires auth)
router.get('/status', requireMagicAuth, getVKStatus);

// Test VK message endpoint (requires auth)
router.post('/test-message', requireMagicAuth, async (req, res) => {
  try {
    const { vkUserId } = req.body;

    if (!vkUserId) {
      return res.status(400).json({ error: 'vkUserId is required' });
    }

    console.log('[VK TEST] Sending test message to VK user:', vkUserId);

    const testVariables = {
      customer_name: 'Тестовый клиент',
      date: '10.06.2026',
      time: '10:00',
      specialist: 'Тестовый специалист',
      service: 'Тестовая услуга',
      booking_link: 'https://bloknotservis.ru/book/test'
    };

    await sendBookingConfirmation(vkUserId, testVariables);

    res.json({ success: true, message: 'Test message sent successfully' });
  } catch (error) {
    console.error('[VK TEST] Error sending test message:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
