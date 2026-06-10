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

// VK Auth callback (no auth required - this is the OAuth callback)
router.get('/callback', vkAuthCallback);

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
