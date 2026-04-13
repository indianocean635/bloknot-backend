const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get current subscription
async function getSubscription(req, res) {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { businessId: req.user.businessId }
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
      where: { businessId: req.user.businessId },
      update: { plan, maxUsers, isActive: true },
      create: {
        businessId: req.user.businessId,
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
    const plans = [
      {
        id: 'SOLO',
        name: 'Solo',
        price: '990',
        users: 1,
        description: '1 specialist'
      },
      {
        id: 'STUDIO',
        name: 'Studio',
        price: '2490',
        users: 5,
        description: 'Up to 5 specialists'
      },
      {
        id: 'PRO',
        name: 'Pro',
        price: '4990',
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
