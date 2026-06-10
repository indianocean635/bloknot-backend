const express = require('express');
const router = express.Router();
const { 
  vkAuthCallback, 
  linkVKAccount, 
  unlinkVKAccount, 
  getVKStatus 
} = require('../controllers/vkAuthController');
const { requireMagicAuth } = require('../middleware/magicAuthMiddleware');

// VK Auth callback (no auth required - this is the OAuth callback)
router.get('/callback', vkAuthCallback);

// Link VK account to existing user (requires auth)
router.post('/link', requireMagicAuth, linkVKAccount);

// Unlink VK account (requires auth)
router.post('/unlink', requireMagicAuth, unlinkVKAccount);

// Get VK connection status (requires auth)
router.get('/status', requireMagicAuth, getVKStatus);

module.exports = router;
