const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

// Plan configuration
const PLANS = {
  solo: {
    name: 'SOLO',
    monthlyPrice: 690,
    yearlyPrice: 6624,
    maxUsers: 1
  },
  studio: {
    name: 'STUDIO',
    monthlyPrice: 990,
    yearlyPrice: 9504,
    maxUsers: 5
  },
  pro: {
    name: 'PRO',
    monthlyPrice: 1490,
    yearlyPrice: 14304,
    maxUsers: 15
  }
};

const TRIAL_DAYS = 5;

// Create payment
async function createPayment(req, res) {
  try {
    console.log('[PAYMENT CREATED]', {
      userId: req.user?.id,
      businessId: req.user?.businessId,
      userEmail: req.user?.email,
      body: req.body
    });

    const { plan, period } = req.body; // period: 'monthly' or 'yearly'
    
    if (!plan || !period) {
      return res.status(400).json({ error: 'Plan and period are required' });
    }

    const planConfig = PLANS[plan];
    if (!planConfig) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    if (!['monthly', 'yearly'].includes(period)) {
      return res.status(400).json({ error: 'Invalid period' });
    }

    const user = req.user;
    if (!user || !user.businessId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const price = period === 'monthly' ? planConfig.monthlyPrice : planConfig.yearlyPrice;
    const currency = 'RUB';
    const description = `${planConfig.name} ${period === 'monthly' ? 'Monthly' : 'Yearly'} Plan`;

    // CloudPayments request data
    const cloudPaymentsData = {
      Amount: price,
      Currency: currency,
      Description: description,
      AccountId: user.businessId,
      InvoiceId: `${user.businessId}_${Date.now()}`,
      Email: user.email,
      RequireConfirmation: period === 'monthly', // Require confirmation for recurring
      TrialPeriod: period === 'monthly' ? TRIAL_DAYS : null,
      Recurring: {
        Interval: period === 'monthly' ? 'Month' : null,
        Period: period === 'monthly' ? 1 : null
      }
    };

    console.log('[CLOUDPAYMENTS REQUEST]', cloudPaymentsData);

    // Check if CloudPayments credentials are configured
    const publicId = process.env.CLOUDPAYMENTS_PUBLIC_ID;
    const apiSecret = process.env.CLOUDPAYMENTS_API_SECRET;

    if (!publicId || !apiSecret || publicId === 'your-cloudpayments-public-id' || apiSecret === 'your-cloudpayments-api-secret') {
      console.log('[CLOUDPAYMENTS] Credentials not configured, using test mode');

      // Test mode: create subscription without actual payment
      if (period === 'monthly') {
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

        const subscription = await prisma.subscription.upsert({
          where: { businessId: user.businessId },
          update: {
            plan: planConfig.name,
            maxUsers: planConfig.maxUsers,
            usersLimit: planConfig.maxUsers,
            subscriptionStatus: 'TRIAL',
            trialEndsAt,
            billingPeriod: 'MONTHLY',
            cloudpaymentsSubscriptionId: null,
            nextPaymentDate: trialEndsAt,
            isActive: true
          },
          create: {
            businessId: user.businessId,
            plan: planConfig.name,
            maxUsers: planConfig.maxUsers,
            usersLimit: planConfig.maxUsers,
            subscriptionStatus: 'TRIAL',
            trialEndsAt,
            billingPeriod: 'MONTHLY',
            cloudpaymentsSubscriptionId: null,
            nextPaymentDate: trialEndsAt,
            isActive: true
          }
        });

        console.log('[TEST MODE] Trial started', {
          businessId: user.businessId,
          plan: planConfig.name,
          trialEndsAt
        });

        return res.json({
          success: true,
          subscription,
          testMode: true,
          message: 'Test mode: CloudPayments credentials not configured'
        });
      }

      // For yearly plans in test mode
      const subscriptionEndsAt = new Date();
      subscriptionEndsAt.setFullYear(subscriptionEndsAt.getFullYear() + 1);

      const subscription = await prisma.subscription.upsert({
        where: { businessId: user.businessId },
        update: {
          plan: planConfig.name,
          maxUsers: planConfig.maxUsers,
          usersLimit: planConfig.maxUsers,
          subscriptionStatus: 'ACTIVE',
          subscriptionEndsAt,
          billingPeriod: 'YEARLY',
          cloudpaymentsSubscriptionId: null,
          nextPaymentDate: null,
          isActive: true
        },
        create: {
          businessId: user.businessId,
          plan: planConfig.name,
          maxUsers: planConfig.maxUsers,
          usersLimit: planConfig.maxUsers,
          subscriptionStatus: 'ACTIVE',
          subscriptionEndsAt,
          billingPeriod: 'YEARLY',
          cloudpaymentsSubscriptionId: null,
          nextPaymentDate: null,
          isActive: true
        }
      });

      console.log('[TEST MODE] Yearly subscription activated', {
        businessId: user.businessId,
        plan: planConfig.name,
        subscriptionEndsAt
      });

      return res.json({
        success: true,
        subscription,
        testMode: true,
        message: 'Test mode: CloudPayments credentials not configured'
      });
    }

    // Create payment with CloudPayments API
    const cloudpaymentsResponse = await createCloudPaymentsPayment(cloudPaymentsData);

    if (!cloudpaymentsResponse.Success) {
      console.error('[CLOUDPAYMENTS ERROR]', cloudpaymentsResponse);
      return res.status(500).json({ error: 'Payment creation failed' });
    }

    // For monthly plans, start trial immediately
    if (period === 'monthly') {
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

      const subscription = await prisma.subscription.upsert({
        where: { businessId: user.businessId },
        update: {
          plan: planConfig.name,
          maxUsers: planConfig.maxUsers,
          usersLimit: planConfig.maxUsers,
          subscriptionStatus: 'TRIAL',
          trialEndsAt,
          billingPeriod: 'MONTHLY',
          cloudpaymentsSubscriptionId: cloudpaymentsResponse.Model?.SubscriptionId || null,
          nextPaymentDate: trialEndsAt,
          isActive: true
        },
        create: {
          businessId: user.businessId,
          plan: planConfig.name,
          maxUsers: planConfig.maxUsers,
          usersLimit: planConfig.maxUsers,
          subscriptionStatus: 'TRIAL',
          trialEndsAt,
          billingPeriod: 'MONTHLY',
          cloudpaymentsSubscriptionId: cloudpaymentsResponse.Model?.SubscriptionId || null,
          nextPaymentDate: trialEndsAt,
          isActive: true
        }
      });

      console.log('[TRIAL STARTED]', {
        businessId: user.businessId,
        plan: planConfig.name,
        trialEndsAt
      });

      return res.json({
        success: true,
        subscription,
        cloudPayments: cloudpaymentsResponse.Model
      });
    }

    // For yearly plans, wait for payment confirmation
    res.json({
      success: true,
      cloudPayments: cloudpaymentsResponse.Model,
      plan: planConfig.name,
      period,
      price
    });
  } catch (error) {
    console.error('[PAYMENT ERROR]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Create CloudPayments payment
async function createCloudPaymentsPayment(data) {
  const publicId = process.env.CLOUDPAYMENTS_PUBLIC_ID;
  const apiSecret = process.env.CLOUDPAYMENTS_API_SECRET;

  if (!publicId || !apiSecret) {
    throw new Error('CloudPayments credentials not configured');
  }

  const response = await fetch('https://api.cloudpayments.ru/payments/cards/charge', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${Buffer.from(`${publicId}:${apiSecret}`).toString('base64')}`
    },
    body: JSON.stringify(data)
  });

  return response.json();
}

// Verify CloudPayments signature
function verifyCloudPaymentsSignature(data, signature) {
  const apiSecret = process.env.CLOUDPAYMENTS_API_SECRET;
  if (!apiSecret) return false;

  const sortedKeys = Object.keys(data).sort();
  const signatureString = sortedKeys
    .map(key => `${key}${data[key]}`)
    .join('');
  
  const expectedSignature = crypto
    .createHash('sha256')
    .update(signatureString + apiSecret)
    .digest('hex');

  return signature === expectedSignature;
}

// Handle CloudPayments webhook
async function handleCloudPaymentsWebhook(req, res) {
  try {
    const eventData = req.body;
    console.log('[CLOUDPAYMENTS WEBHOOK]', JSON.stringify(eventData, null, 2));

    // Verify signature
    const signature = req.headers['x-signature'];
    if (!verifyCloudPaymentsSignature(eventData, signature)) {
      console.error('[WEBHOOK] Invalid signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const eventType = eventData.Event;
    const accountId = eventData.AccountId; // businessId
    const subscriptionId = eventData.SubscriptionId;
    const transactionId = eventData.TransactionId;

    // Protection against duplicate webhooks
    const existingTransaction = await prisma.subscription.findFirst({
      where: {
        businessId: accountId,
        cloudpaymentsSubscriptionId: subscriptionId
      }
    });

    if (!existingTransaction) {
      console.error('[WEBHOOK] Subscription not found', { accountId, subscriptionId });
      return res.status(404).json({ error: 'Subscription not found' });
    }

    switch (eventType) {
      case 'Pay':
        await handlePaymentSuccess(accountId, transactionId, eventData);
        break;

      case 'Confirm':
        await handlePaymentConfirm(accountId, transactionId, eventData);
        break;

      case 'Fail':
        await handlePaymentFail(accountId, transactionId, eventData);
        break;

      case 'Cancel':
        await handleSubscriptionCancel(accountId, subscriptionId);
        break;

      case 'Recurrent':
        await handleRecurrentPayment(accountId, subscriptionId, transactionId, eventData);
        break;

      case 'Refund':
        await handleRefund(accountId, transactionId, eventData);
        break;

      default:
        console.log('[WEBHOOK] Unknown event type', eventType);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[WEBHOOK ERROR]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Handle successful payment
async function handlePaymentSuccess(businessId, transactionId, eventData) {
  console.log('[PAYMENT SUCCESS]', { businessId, transactionId });

  const subscription = await prisma.subscription.findUnique({
    where: { businessId }
  });

  if (!subscription) return;

  // For yearly plans, activate immediately
  if (subscription.billingPeriod === 'YEARLY') {
    const subscriptionEndsAt = new Date();
    subscriptionEndsAt.setFullYear(subscriptionEndsAt.getFullYear() + 1);

    await prisma.subscription.update({
      where: { businessId },
      data: {
        subscriptionStatus: 'ACTIVE',
        subscriptionEndsAt,
        lastPaymentAt: new Date(),
        isActive: true
      }
    });

    console.log('[SUBSCRIPTION ACTIVATED]', { businessId, subscriptionEndsAt });
  }
}

// Handle payment confirmation
async function handlePaymentConfirm(businessId, transactionId, eventData) {
  console.log('[PAYMENT CONFIRM]', { businessId, transactionId });

  const subscription = await prisma.subscription.findUnique({
    where: { businessId }
  });

  if (!subscription) return;

  await prisma.subscription.update({
    where: { businessId },
    data: {
      lastPaymentAt: new Date()
    }
  });
}

// Handle payment failure
async function handlePaymentFail(businessId, transactionId, eventData) {
  console.log('[PAYMENT FAILED]', { businessId, transactionId });

  const subscription = await prisma.subscription.findUnique({
    where: { businessId }
  });

  if (!subscription) return;

  // If trial payment failed, cancel subscription
  if (subscription.subscriptionStatus === 'TRIAL') {
    await prisma.subscription.update({
      where: { businessId },
      data: {
        subscriptionStatus: 'CANCELLED',
        isActive: false
      }
    });
  }
}

// Handle subscription cancellation
async function handleSubscriptionCancel(businessId, subscriptionId) {
  console.log('[SUBSCRIPTION CANCELLED]', { businessId, subscriptionId });

  await prisma.subscription.update({
    where: { businessId },
    data: {
      subscriptionStatus: 'CANCELLED',
      isActive: false,
      cloudpaymentsSubscriptionId: null
    }
  });
}

// Handle recurrent payment
async function handleRecurrentPayment(businessId, subscriptionId, transactionId, eventData) {
  console.log('[RECURRING SUCCESS]', { businessId, subscriptionId, transactionId });

  const subscription = await prisma.subscription.findUnique({
    where: { businessId }
  });

  if (!subscription) return;

  // Update next payment date (30 days from now)
  const nextPaymentDate = new Date();
  nextPaymentDate.setDate(nextPaymentDate.getDate() + 30);

  await prisma.subscription.update({
    where: { businessId },
    data: {
      subscriptionStatus: 'ACTIVE',
      lastPaymentAt: new Date(),
      nextPaymentDate,
      isActive: true
    }
  });

  console.log('[RECURRING SUCCESS]', { businessId, nextPaymentDate });
}

// Handle refund
async function handleRefund(businessId, transactionId, eventData) {
  console.log('[REFUND]', { businessId, transactionId });

  const subscription = await prisma.subscription.findUnique({
    where: { businessId }
  });

  if (!subscription) return;

  // For yearly refunds, cancel subscription
  if (subscription.billingPeriod === 'YEARLY') {
    await prisma.subscription.update({
      where: { businessId },
      data: {
        subscriptionStatus: 'CANCELLED',
        isActive: false
      }
    });
  }
}

module.exports = {
  createPayment,
  handleCloudPaymentsWebhook
};
