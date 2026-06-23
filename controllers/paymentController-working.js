const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

// Plan configuration
const PLANS = {
  solo: {
    name: 'SOLO',
    monthlyPrice: 690,
    yearlyPrice: 6624,
    maxUsers: 1,
    maxMasters: 1,
    maxBranches: 1
  },
  business: {
    name: 'BUSINESS',
    monthlyPrice: 1290,
    yearlyPrice: 12384,
    maxUsers: 5,
    maxMasters: 10,
    maxBranches: 5
  }
};

const TRIAL_DAYS = 5;

// Create payment
async function createPayment(req, res) {
  try {
    const { period, plan } = req.body;
    const user = req.user;

    if (!user || !user.businessId) {
      return res.status(403).json({ error: 'User not authenticated or no business' });
    }

    const selectedPlan = PLANS[plan];
    if (!selectedPlan) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const price = period === 'yearly' ? selectedPlan.yearlyPrice : selectedPlan.monthlyPrice;
    const currency = 'RUB';

    // Check existing subscription
    const existingSubscription = await prisma.subscription.findUnique({
      where: { businessId: user.businessId }
    });

    let subscriptionData = {
      Amount: price,
      Currency: currency,
      InvoiceId: `${user.businessId}_${Date.now()}`,
      Email: user.email,
      RequireConfirmation: period === 'monthly', // Require confirmation for recurring
      TrialPeriod: period === 'monthly' ? TRIAL_DAYS : null,
      Recurring: period === 'monthly' ? {
        Interval: 'Month',
        Period: 1
      } : null,
      CultureName: 'ru-RU',
      Description: `${selectedPlan.name} ${period === 'yearly' ? 'Ежегодный план' : 'Ежемесячный план'}`
    };

    console.log('[PAYMENT REQUEST]', {
      businessId: user.businessId,
      plan: selectedPlan.name,
      period,
      price,
      currency,
      hasExistingSubscription: !!existingSubscription,
      subscriptionData
    });

    res.json({
      success: true,
      paymentData: subscriptionData,
      plan: selectedPlan.name,
      period,
      price
    });

  } catch (error) {
    console.error('[PAYMENT ERROR]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Verify CloudPayments signature
function verifyCloudPaymentsSignature(req, signature) {
  const apiSecret = process.env.CLOUDPAYMENTS_API_SECRET;
  if (!apiSecret) {
    console.error('[WEBHOOK] CLOUDPAYMENTS_API_SECRET not configured');
    return false;
  }

  // Use rawBody for signature verification
  const rawBody = req.rawBody;
  if (!rawBody) {
    console.error('[WEBHOOK] No raw body available for signature verification');
    return false;
  }

  const body = rawBody.toString('utf8');
  
  // Calculate HMAC-SHA256 signature and convert to Base64
  const hmacBinary = crypto.createHmac('sha256', apiSecret).update(body).digest();
  const calculatedSignature = hmacBinary.toString('base64');

  return signature === calculatedSignature;
}

// Handle CloudPayments webhook
async function handleCloudPaymentsWebhook(req, res) {
  try {
    console.log('[WEBHOOK RECEIVED]', {
      method: req.method,
      url: req.url,
      headers: req.headers,
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length']
    });

    const eventData = req.body;
    console.log('[WEBHOOK BODY]', JSON.stringify(eventData, null, 2));
    console.log('[WEBHOOK RAW BODY]', {
      hasRawBody: !!req.rawBody,
      rawBodyLength: req.rawBody?.length || 0,
      rawBodyPreview: req.rawBody?.substring(0, 200) + '...'
    });

    // Verify signature
    const signature =
        req.headers['content-hmac'] ||
        req.headers['x-content-hmac'] ||
        req.get('Content-HMAC') ||
        req.get('X-Content-HMAC');
    
    console.log('[WEBHOOK SIGNATURE HEADERS]', {
      'content-hmac': req.headers['content-hmac'],
      'x-content-hmac': req.headers['x-content-hmac'],
      'Content-HMAC': req.get('Content-HMAC'),
      'X-Content-HMAC': req.get('X-Content-HMAC'),
      finalSignature: signature,
      signatureLength: signature?.length
    });
    
    if (!signature) {
      console.error('[WEBHOOK] No signature provided');
      return res.status(401).json({ error: 'No signature provided' });
    }
    
    if (!verifyCloudPaymentsSignature(req, signature)) {
      console.error('[WEBHOOK] Invalid signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    console.log('[SIGNATURE VALID]');

    // CloudPayments использует OperationType вместо Event
    const eventType = eventData.OperationType || eventData.Event;
    const accountId = eventData.AccountId; // businessId
    const subscriptionId = eventData.SubscriptionId;
    const transactionId = eventData.TransactionId;

    console.log('[WEBHOOK EVENT PROCESSING]', {
      eventType,
      accountId,
      subscriptionId,
      transactionId,
      amount: eventData.Amount,
      status: eventData.Status
    });

    switch (eventType) {
      case 'Pay':
      case 'Payment':  // CloudPayments отправляет "Payment"
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
  console.log('[PAYMENT SUCCESS]', { businessId, transactionId, eventData });

  const subscription = await prisma.subscription.findUnique({
    where: { businessId }
  });

  // If no subscription exists, create one for successful payment
  if (!subscription) {
    console.log('[CREATING SUBSCRIPTION FROM PAYMENT]', { 
      businessId, 
      subscriptionId: eventData.SubscriptionId,
      amount: eventData.Amount,
      message: 'Creating subscription from successful payment'
    });
    
    const subscriptionEndsAt = new Date();
    subscriptionEndsAt.setMonth(subscriptionEndsAt.getMonth() + 1); // Monthly by default
    
    await prisma.subscription.create({
      data: {
        businessId,
        plan: 'SOLO',
        maxUsers: 1,
        usersLimit: 1,
        subscriptionStatus: 'ACTIVE',
        subscriptionEndsAt,
        billingPeriod: 'MONTHLY',
        cloudpaymentsSubscriptionId: eventData.SubscriptionId,
        nextPaymentDate: subscriptionEndsAt,
        isActive: true,
        cardAttachedAt: new Date(),
        lastPaymentAt: new Date(),
        autoRenewal: true
      }
    });

    console.log('[SUBSCRIPTION ACTIVATED]', { 
      businessId, 
      subscriptionEndsAt,
      amount: eventData.Amount,
      subscriptionId: eventData.SubscriptionId,
      plan: 'SOLO',
      message: 'Monthly SOLO subscription activated successfully'
    });
    
    return;
  }

  // For yearly plans, activate immediately
  if (subscription.billingPeriod === 'YEARLY') {
    const subscriptionEndsAt = new Date();
    subscriptionEndsAt.setFullYear(subscriptionEndsAt.getFullYear() + 1);

    await prisma.subscription.update({
      where: { businessId },
      data: {
        subscriptionStatus: 'ACTIVE',
        subscriptionEndsAt,
        nextPaymentDate: subscriptionEndsAt,
        lastPaymentAt: new Date(),
        cloudpaymentsSubscriptionId: eventData.SubscriptionId
      }
    });

    console.log('[YEARLY SUBSCRIPTION ACTIVATED]', { 
      businessId, 
      subscriptionEndsAt,
      amount: eventData.Amount
    });
    return;
  }

  // For monthly plans, update payment info
  await prisma.subscription.update({
    where: { businessId },
    data: {
      lastPaymentAt: new Date(),
      cloudpaymentsSubscriptionId: eventData.SubscriptionId
    }
  });

  console.log('[PAYMENT INFO UPDATED]', { 
    businessId, 
    amount: eventData.Amount,
    subscriptionId: eventData.SubscriptionId
  });
}

// Handle payment confirmation
async function handlePaymentConfirm(businessId, transactionId, eventData) {
  console.log('[PAYMENT CONFIRM]', { businessId, transactionId });

  const subscription = await prisma.subscription.findUnique({
    where: { businessId }
  });

  // If no subscription exists, this is a new card authorization - create TRIAL subscription
  if (!subscription) {
    console.log('[CARD AUTHORIZED - CREATING TRIAL]', { 
      businessId, 
      subscriptionId: eventData.SubscriptionId,
      message: 'Card successfully authorized, creating trial subscription'
    });
    
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);
    
    await prisma.subscription.create({
      data: {
        businessId,
        plan: 'SOLO', // Default plan - can be determined from eventData if needed
        maxUsers: 1,
        usersLimit: 1,
        subscriptionStatus: 'TRIAL',
        trialEndsAt,
        billingPeriod: 'MONTHLY',
        cloudpaymentsSubscriptionId: eventData.SubscriptionId,
        nextPaymentDate: trialEndsAt,
        isActive: true,
        cardAttachedAt: new Date(),
        lastPaymentAt: new Date(),
        autoRenewal: true, // Включить автоматическое продление
        trialToPaidConversionDate: trialEndsAt // Дата конвертации в платную подписку
      }
    });
    
    return;
  }

  // For existing subscriptions, update card attachment time
  if (subscription.subscriptionStatus === 'TRIAL' && subscription.billingPeriod === 'MONTHLY') {
    console.log('[TRIAL CARD ATTACHED]', { 
      businessId, 
      subscriptionId: eventData.SubscriptionId,
      message: 'Card attached for trial period'
    });
    
    await prisma.subscription.update({
      where: { businessId },
      data: {
        cloudpaymentsSubscriptionId: eventData.SubscriptionId,
        lastPaymentAt: new Date(),
        cardAttachedAt: new Date()
      }
    });
  } else {
    // For other cases, just update last payment time
    await prisma.subscription.update({
      where: { businessId },
      data: {
        lastPaymentAt: new Date()
      }
    });
  }
}

// Handle payment failure
async function handlePaymentFail(businessId, transactionId, eventData) {
  console.log('[PAYMENT FAIL]', { businessId, transactionId, eventData });

  const subscription = await prisma.subscription.findUnique({
    where: { businessId }
  });

  if (subscription) {
    await prisma.subscription.update({
      where: { businessId },
      data: {
        subscriptionStatus: 'GRACE_PERIOD',
        gracePeriodEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days grace period
        lastPaymentAttempt: new Date()
      }
    });
  }
}

// Handle subscription cancellation
async function handleSubscriptionCancel(businessId, subscriptionId) {
  console.log('[SUBSCRIPTION CANCEL]', { businessId, subscriptionId });

  await prisma.subscription.update({
    where: { businessId },
    data: {
      subscriptionStatus: 'CANCELLED',
      autoRenewal: false,
      cancelledAt: new Date()
    }
  });
}

// Handle recurrent payment
async function handleRecurrentPayment(businessId, subscriptionId, transactionId, eventData) {
  console.log('[RECURRENT PAYMENT]', { businessId, subscriptionId, transactionId });

  const subscription = await prisma.subscription.findUnique({
    where: { businessId }
  });

  if (subscription) {
    const nextPaymentDate = new Date();
    nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);

    await prisma.subscription.update({
      where: { businessId },
      data: {
        subscriptionStatus: 'ACTIVE',
        lastPaymentAt: new Date(),
        nextPaymentDate,
        gracePeriodEndsAt: null
      }
    });
  }
}

// Handle refund
async function handleRefund(businessId, transactionId, eventData) {
  console.log('[REFUND]', { businessId, transactionId, eventData });

  const subscription = await prisma.subscription.findUnique({
    where: { businessId }
  });

  if (subscription) {
    await prisma.subscription.update({
      where: { businessId },
      data: {
        subscriptionStatus: 'REFUNDED',
        refundedAt: new Date()
      }
    });
  }
}

// Card attachment endpoint
async function attachCard(req, res) {
  try {
    const user = req.user;
    
    if (!user || !user.businessId) {
      return res.status(403).json({ error: 'User not authenticated or no business' });
    }

    console.log('[CARD ATTACHMENT] Creating TRIAL subscription for user:', user.businessId);
    
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);
    
    let subscription = await prisma.subscription.findUnique({
      where: { businessId: user.businessId }
    });

    if (!subscription) {
      subscription = await prisma.subscription.create({
        data: {
          businessId: user.businessId,
          plan: 'SOLO',
          maxUsers: 1,
          usersLimit: 1,
          subscriptionStatus: 'TRIAL',
          trialEndsAt,
          billingPeriod: 'MONTHLY',
          nextPaymentDate: trialEndsAt,
          isActive: true,
          cardAttachedAt: new Date(),
          lastPaymentAt: new Date(),
          autoRenewal: true
        }
      });
    } else {
      subscription = await prisma.subscription.update({
        where: { businessId: user.businessId },
        data: {
          subscriptionStatus: 'TRIAL',
          trialEndsAt,
          nextPaymentDate: trialEndsAt,
          cardAttachedAt: new Date(),
          lastPaymentAt: new Date(),
          autoRenewal: true
        }
      });
    }

    console.log('[TRIAL SUBSCRIPTION CREATED]', {
      businessId: user.businessId,
      trialEndsAt,
      subscriptionId: subscription.id
    });

    res.json({
      success: true,
      subscription: {
        status: subscription.subscriptionStatus,
        trialEndsAt: subscription.trialEndsAt,
        nextPaymentDate: subscription.nextPaymentDate,
        plan: subscription.plan
      }
    });

  } catch (error) {
    console.error('[CARD ATTACHMENT ERROR]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Get subscription status
async function getSubscriptionStatus(req, res) {
  try {
    const user = req.user;
    
    if (!user || !user.businessId) {
      return res.status(403).json({ error: 'User not authenticated or no business' });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { businessId: user.businessId }
    });

    if (!subscription) {
      return res.json({
        hasSubscription: false,
        message: 'No active subscription'
      });
    }

    const now = new Date();
    const isActive = subscription.isActive && 
                   (subscription.subscriptionEndsAt ? subscription.subscriptionEndsAt > now : true) &&
                   subscription.subscriptionStatus !== 'CANCELLED';

    res.json({
      hasSubscription: true,
      subscription: {
        status: subscription.subscriptionStatus,
        plan: subscription.plan,
        isActive,
        trialEndsAt: subscription.trialEndsAt,
        subscriptionEndsAt: subscription.subscriptionEndsAt,
        nextPaymentDate: subscription.nextPaymentDate,
        autoRenewal: subscription.autoRenewal,
        cardAttachedAt: subscription.cardAttachedAt,
        lastPaymentAt: subscription.lastPaymentAt,
        gracePeriodEndsAt: subscription.gracePeriodEndsAt
      }
    });

  } catch (error) {
    console.error('[GET SUBSCRIPTION ERROR]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Cancel subscription
async function cancelSubscription(req, res) {
  try {
    const user = req.user;
    
    if (!user || !user.businessId) {
      return res.status(403).json({ error: 'User not authenticated or no business' });
    }

    const subscription = await prisma.subscription.update({
      where: { businessId: user.businessId },
      data: {
        subscriptionStatus: 'CANCELLED',
        autoRenewal: false,
        cancelledAt: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Subscription cancelled successfully',
      subscription: {
        status: subscription.subscriptionStatus,
        cancelledAt: subscription.cancelledAt
      }
    });

  } catch (error) {
    console.error('[CANCEL SUBSCRIPTION ERROR]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  createPayment,
  handleCloudPaymentsWebhook,
  attachCard,
  getSubscriptionStatus,
  cancelSubscription
};
