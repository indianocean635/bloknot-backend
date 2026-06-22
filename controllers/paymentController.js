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

    // Check if user has an active trial subscription
    const existingSubscription = await prisma.subscription.findUnique({
      where: { businessId: req.user.businessId }
    });

    if (existingSubscription && existingSubscription.subscriptionStatus === 'TRIAL') {
      const trialEndsAt = new Date(existingSubscription.trialEndsAt);
      const now = new Date();
      
      if (trialEndsAt > now) {
        const remainingDays = Math.ceil((trialEndsAt - now) / (1000 * 60 * 60 * 24));
        
        console.log('[TRIAL RESTRICTION]', {
          businessId: req.user.businessId,
          currentPlan: existingSubscription.plan,
          requestedPlan: plan,
          trialEndsAt: existingSubscription.trialEndsAt,
          remainingDays
        });

        return res.status(400).json({ 
          error: 'TRIAL_RESTRICTION',
          message: `Вы уже используете пробный период тарифа "${existingSubscription.plan}". 
                    Доступна смена тарифа через ${remainingDays} дней. 
                    Для немедленной смены тарифа отмените текущую подписку в настройках.`,
          currentPlan: existingSubscription.plan,
          trialEndsAt: existingSubscription.trialEndsAt,
          remainingDays
        });
      }
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
      Recurring: period === 'monthly' ? {
        Interval: 'Month',
        Period: 1
      } : {
        Interval: 'Year',
        Period: 1
      }
    };

    console.log('[CLOUDPAYMENTS REQUEST]', cloudPaymentsData);

    // Check if CloudPayments credentials are configured
    const publicId = process.env.CLOUDPAYMENTS_PUBLIC_ID;
    const apiSecret = process.env.CLOUDPAYMENTS_API_SECRET;

    if (!publicId || !apiSecret) {
      return res.status(500).json({ 
        error: 'CloudPayments credentials not configured',
        details: 'Please set CLOUDPAYMENTS_PUBLIC_ID and CLOUDPAYMENTS_API_SECRET in environment'
      });
    }

    // Return payment data for CloudPayments widget (widget will handle the actual payment)
    const cloudPaymentsDataForWidget = {
      PublicId: publicId,
      Description: description,
      Amount: period === 'monthly' ? 1 : price, // 1 for auth (trial), full price for yearly
      Currency: currency,
      InvoiceId: cloudPaymentsData.InvoiceId,
      AccountId: user.businessId,
      Email: user.email,
      RequireConfirmation: cloudPaymentsData.RequireConfirmation,
      TrialPeriod: cloudPaymentsData.TrialPeriod,
      Recurring: cloudPaymentsData.Recurring
    };

    console.log('[CLOUDPAYMENTS] Data prepared for widget:', cloudPaymentsDataForWidget);

    // For all plans (monthly and yearly), return widget data for payment processing
    // Do NOT create subscription yet - only create after successful card authorization
    // This prevents users from getting trial without card attachment
    
    console.log('[PAYMENT INIT]', {
      businessId: user.businessId,
      plan: planConfig.name,
      period: period,
      message: 'Payment initialized - subscription will be created after card authorization'
    });

    // Return payment widget data without creating subscription
    return res.json({
      success: true,
      cloudPayments: cloudPaymentsDataForWidget,
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

  console.log('[CLOUDPAYMENTS] API Request:', {
    url: 'https://api.cloudpayments.ru/payments/cards/auth',
    publicId: publicId.substring(0, 8) + '...',
    data: data
  });

  const response = await fetch('https://api.cloudpayments.ru/payments/cards/auth', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${Buffer.from(`${publicId}:${apiSecret}`).toString('base64')}`
    },
    body: JSON.stringify(data)
  });

  // Log response status and headers
  console.log('[CLOUDPAYMENTS] Response Status:', response.status);
  console.log('[CLOUDPAYMENTS] Response Headers:', Object.fromEntries(response.headers.entries()));

  // Get response text first to debug
  const responseText = await response.text();
  console.log('[CLOUDPAYMENTS] Response Text (first 200 chars):', responseText.substring(0, 200));

  // Check if response is HTML (error page)
  if (responseText.startsWith('<!DOCTYPE') || responseText.startsWith('<html')) {
    console.error('[CLOUDPAYMENTS] Received HTML instead of JSON - API error or wrong credentials');
    throw new Error('CloudPayments API returned HTML error page. Check credentials and API access.');
  }

  // Parse JSON
  try {
    return JSON.parse(responseText);
  } catch (error) {
    console.error('[CLOUDPAYMENTS] Failed to parse JSON:', error);
    throw new Error('Invalid JSON response from CloudPayments API');
  }
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
    const signature =
        req.headers['content-hmac'] ||
        req.headers['x-content-hmac'] ||
        req.get('Content-HMAC') ||
        req.get('X-Content-HMAC');
    
    console.log('SIGNATURE FOUND:', signature);
    console.log('[WEBHOOK] Signature verification:', { 
      hasSignature: !!signature, 
      signatureLength: signature?.length,
      headers: Object.keys(req.headers)
    });
    
    if (!signature) {
      console.error('[WEBHOOK] No signature provided');
      return res.status(401).json({ error: 'No signature provided' });
    }
    
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
        cloudpaymentsSubscriptionId: eventData.SubscriptionId,
        lastPaymentAt: new Date(),
        cardAttachedAt: new Date(),
        isActive: true
      }
    });

    console.log('[YEARLY SUBSCRIPTION ACTIVATED]', { 
      businessId, 
      subscriptionEndsAt,
      amount: eventData.Amount,
      message: 'Yearly subscription activated for 1 year'
    });
  }
  
  // For monthly plans with trial, keep TRIAL status - don't charge immediately
  if (subscription.billingPeriod === 'MONTHLY' && subscription.subscriptionStatus === 'TRIAL') {
    console.log('[TRIAL PAYMENT PROCESSED]', { 
      businessId, 
      trialEndsAt: subscription.trialEndsAt,
      message: 'Payment processed but keeping TRIAL status - actual charge will happen after trial period'
    });
    
    // Update cloudpayments subscription ID but keep TRIAL status
    await prisma.subscription.update({
      where: { businessId },
      data: {
        cloudpaymentsSubscriptionId: eventData.SubscriptionId,
        lastPaymentAt: new Date(),
        cardAttachedAt: new Date()
      }
    });
  }
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

// Save card attachment status immediately after successful authorization
async function saveCardAttachment(req, res) {
  try {
    console.log('[CARD ATTACHMENT] Saving card attachment status for user:', req.user?.email);
    
    if (!req.user || !req.user.businessId) {
      return res.status(403).json({ error: 'User not authenticated' });
    }

    // Find existing subscription
    let subscription = await prisma.subscription.findUnique({
      where: { businessId: req.user.businessId }
    });

    let updatedSubscription;
    
    if (!subscription) {
      // Create TRIAL subscription if it doesn't exist
      console.log('[CARD ATTACHMENT] Creating TRIAL subscription for user:', req.user.businessId);
      
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);
      
      subscription = await prisma.subscription.create({
        data: {
          businessId: req.user.businessId,
          plan: 'SOLO', // Default plan
          maxUsers: 1,
          usersLimit: 1,
          subscriptionStatus: 'TRIAL',
          trialEndsAt,
          billingPeriod: 'MONTHLY',
          cloudpaymentsSubscriptionId: null,
          nextPaymentDate: trialEndsAt,
          isActive: true,
          cardAttachedAt: new Date(),
          lastPaymentAt: new Date()
        }
      });
      
      updatedSubscription = subscription;
      
      console.log('[CARD ATTACHMENT] TRIAL subscription created:', {
        businessId: req.user.businessId,
        trialEndsAt,
        subscriptionId: subscription.id
      });
    } else {
      // Update existing subscription
      updatedSubscription = await prisma.subscription.update({
        where: { businessId: req.user.businessId },
        data: {
          cardAttachedAt: new Date()
        }
      });
    }

    console.log('[CARD ATTACHMENT] Status updated successfully:', {
      businessId: req.user.businessId,
      cardAttachedAt: updatedSubscription.cardAttachedAt
    });

    res.json({ 
      success: true, 
      message: 'Card attachment status saved successfully',
      cardAttachedAt: updatedSubscription.cardAttachedAt 
    });
  } catch (error) {
    console.error('[CARD ATTACHMENT] Error saving status:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

module.exports = {
  createPayment,
  handleCloudPaymentsWebhook,
  saveCardAttachment
};
