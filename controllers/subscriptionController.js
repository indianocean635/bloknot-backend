const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get current subscription
async function getSubscription(req, res) {
  try {
    console.log('[REQUEST]', {
      userId: req.user?.id,
      businessId: req.user?.businessId,
      route: req.originalUrl
    });

    const user = req.user;
    
    if (!user || !user.businessId) {
      console.warn('[SECURITY] Missing user or businessId', { userId: req.user?.id, businessId: req.user?.businessId });
      return res.json({ plan: 'FREE', maxUsers: 1 });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { businessId: user.businessId }
    });

    res.json(subscription || { plan: 'FREE', maxUsers: 1 });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Create or update subscription
async function createSubscription(req, res) {
  try {
    console.log('[REQUEST]', {
      userId: req.user?.id,
      businessId: req.user?.businessId,
      route: req.originalUrl
    });

    const user = req.user;
    
    if (!user || !user.businessId) {
      console.warn('[SECURITY] Missing user or businessId', { userId: req.user?.id, businessId: req.user?.businessId });
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { plan } = req.body;
    
    const planLimits = {
      SOLO: 1,
      STUDIO: 5,
      PRO: 15
    };

    const maxUsers = planLimits[plan];
    if (!maxUsers) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const subscription = await prisma.subscription.upsert({
      where: { businessId: user.businessId },
      update: { plan, maxUsers, isActive: true },
      create: {
        businessId: user.businessId,
        plan,
        maxUsers
      }
    });

    res.json(subscription);
  } catch (error) {
    console.error('Create subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Get available plans
async function getPlans(req, res) {
  try {
    console.log('[REQUEST]', {
      userId: req.user?.id,
      businessId: req.user?.businessId,
      route: req.originalUrl
    });

    const user = req.user;
    
    if (!user) {
      console.warn('[SECURITY] Missing user', { userId: req.user?.id });
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const plans = [
      {
        id: 'SOLO',
        name: 'Solo',
        price: '690',
        users: 1,
        description: '1 specialist'
      },
      {
        id: 'STUDIO',
        name: 'Studio',
        price: '990',
        users: 5,
        description: 'Up to 5 specialists'
      },
      {
        id: 'PRO',
        name: 'Pro',
        price: '1490',
        users: 15,
        description: 'Up to 15 specialists'
      }
    ];

    res.json(plans);
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getSubscription,
  createSubscription,
  getPlans
};
