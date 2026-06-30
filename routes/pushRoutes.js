const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Store push notification subscriptions
router.post('/subscribe', async (req, res) => {
  try {
    const { token, userAgent, timestamp } = req.body;
    
    if (!token) {
      return res.status(400).json({ 
        success: false, 
        message: 'FCM token is required' 
      });
    }

    // Get current user (if authenticated)
    let userId = null;
    let businessId = null;
    
    // Try to get user from session/cookie
    try {
      const userResponse = await fetch(`${req.protocol}://${req.get('host')}/api/auth/me`, {
        headers: {
          'Cookie': req.headers.cookie || ''
        }
      });
      
      if (userResponse.ok) {
        const userData = await userResponse.json();
        if (userData.success && userData.user) {
          userId = userData.user.id;
          businessId = userData.user.businessId;
          
          // If impersonating, use impersonated user data
          if (userData.user.isImpersonated) {
            userId = userData.user.originalUserId || userId;
            businessId = userData.user.businessId;
          }
        }
      }
    } catch (authError) {
      console.log('[PUSH] No authenticated user found, storing anonymous subscription');
    }

    // Check if subscription already exists
    const existingSubscription = await prisma.pushSubscription.findFirst({
      where: {
        token: token
      }
    });

    if (existingSubscription) {
      // Update existing subscription
      await prisma.pushSubscription.update({
        where: { id: existingSubscription.id },
        data: {
          userId: userId,
          businessId: businessId,
          userAgent: userAgent,
          lastActive: new Date(),
          isActive: true
        }
      });
      
      console.log('[PUSH] Updated existing subscription:', {
        userId,
        businessId,
        token: token.substring(0, 20) + '...'
      });
    } else {
      // Create new subscription
      await prisma.pushSubscription.create({
        data: {
          token: token,
          userId: userId,
          businessId: businessId,
          userAgent: userAgent,
          isActive: true,
          createdAt: new Date(),
          lastActive: new Date()
        }
      });
      
      console.log('[PUSH] Created new subscription:', {
        userId,
        businessId,
        token: token.substring(0, 20) + '...'
      });
    }

    res.json({ 
      success: true, 
      message: 'Successfully subscribed to push notifications' 
    });

  } catch (error) {
    console.error('[PUSH] Error subscribing to push notifications:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Unsubscribe from push notifications
router.post('/unsubscribe', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ 
        success: false, 
        message: 'FCM token is required' 
      });
    }

    // Deactivate subscription
    await prisma.pushSubscription.updateMany({
      where: { token: token },
      data: { isActive: false }
    });

    console.log('[PUSH] Unsubscribed token:', token.substring(0, 20) + '...');

    res.json({ 
      success: true, 
      message: 'Successfully unsubscribed from push notifications' 
    });

  } catch (error) {
    console.error('[PUSH] Error unsubscribing from push notifications:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Get active subscriptions for a business
router.get('/subscriptions/business/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    
    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        businessId: businessId,
        isActive: true
      },
      orderBy: {
        lastActive: 'desc'
      }
    });

    res.json({
      success: true,
      subscriptions: subscriptions
    });

  } catch (error) {
    console.error('[PUSH] Error getting subscriptions:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Send push notification (internal function, not exposed as API)
async function sendPushNotification(businessId, title, body, data = {}) {
  try {
    // Get active subscriptions for this business
    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        businessId: businessId,
        isActive: true
      }
    });

    if (subscriptions.length === 0) {
      console.log('[PUSH] No active subscriptions found for business:', businessId);
      return { success: false, message: 'No active subscriptions' };
    }

    // Send notification to all subscribers
    const results = [];
    
    for (const subscription of subscriptions) {
      try {
        // Here you would integrate with Firebase Admin SDK
        // For now, we'll just log the notification
        console.log('[PUSH] Would send notification:', {
          to: subscription.token.substring(0, 20) + '...',
          title,
          body,
          data,
          businessId,
          userId: subscription.userId
        });

        results.push({
          token: subscription.token,
          success: true
        });
      } catch (error) {
        console.error('[PUSH] Error sending to token:', subscription.token, error);
        results.push({
          token: subscription.token,
          success: false,
          error: error.message
        });
      }
    }

    return {
      success: true,
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };

  } catch (error) {
    console.error('[PUSH] Error sending push notification:', error);
    return { success: false, error: error.message };
  }
}

// Export the send function for use in other routes
module.exports = {
  router,
  sendPushNotification
};
