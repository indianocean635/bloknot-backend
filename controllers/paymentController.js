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
      Recurrent: period === 'monthly' ? {
        Interval: 'Month',
        Period: 1,
        amount: price,  // Сумма тарифа для рекуррентных списаний
        startDate: new Date(Date.now() + (TRIAL_DAYS * 24 * 60 * 60 * 1000)).toISOString().split('T')[0]  // Через 5 дней
      } : {
        Interval: 'Year',
        Period: 1,
        amount: price,  // Сумма тарифа для рекуррентных списаний
        startDate: new Date(Date.now() + (TRIAL_DAYS * 24 * 60 * 60 * 1000)).toISOString().split('T')[0]  // Через 5 дней
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
      Recurrent: cloudPaymentsData.Recurrent
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
function verifyCloudPaymentsSignature(req, signature) {
  const apiSecret = process.env.CLOUDPAYMENTS_API_SECRET;
  if (!apiSecret) return false;

  // Детальная проверка rawBody vs body
  const hasRawBody = !!req.rawBody;
  const rawBodyLength = req.rawBody?.length || 0;
  const bodyString = JSON.stringify(req.body);
  const bodyStringLength = bodyString.length;
  
  // Используем сырое тело если доступно, иначе парсированный JSON
  const body = req.rawBody || bodyString;
  
  // Согласно документации: hash_hmac('SHA256', $post_data, $secret_key, true)
  const expectedSignatureBase64 = crypto
    .createHmac('sha256', apiSecret)
    .update(body)
    .digest('base64');

  const isMatch = signature === expectedSignatureBase64;

  // Детальное логирование для анализа
  const secretMasked = apiSecret ? 
    apiSecret.substring(0, 3) + '...' + apiSecret.substring(apiSecret.length - 3) : 
    'undefined';

  console.log('[WEBHOOK SIGNATURE DEBUG]', {
    receivedSignature: signature,
    calculatedSignature: expectedSignatureBase64,
    secretLength: apiSecret?.length || 0,
    secretMasked: secretMasked,
    rawBodyCheck: {
      hasRawBody: hasRawBody,
      rawBodyLength: rawBodyLength,
      rawBodyPreview: req.rawBody?.substring(0, 100) + '...',
      bodyStringLength: bodyStringLength,
      bodyStringPreview: bodyString.substring(0, 100) + '...',
      bodiesMatch: req.rawBody === bodyString
    },
    usedBody: {
      source: hasRawBody ? 'rawBody' : 'JSON.stringify(req.body)',
      length: body.length,
      preview: body.substring(0, 100) + '...'
    },
    algorithm: 'HMAC-SHA256',
    format: 'base64_encode(hash_hmac(SHA256, raw_body, secret, true))',
    isMatch: isMatch
  });

  return isMatch;
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
        // Если AccountId пустой, это оплата через widget.auth для смены тарифа
        // Подписка создается через changeSubscriptionPlan, здесь только обновляем платеж
        if (!accountId) {
          console.log('[WEBHOOK] Payment without AccountId - likely plan change, but we need to find user and update token');
          
          // Пытаемся найти пользователя по email из Description или других полей
          const userEmail = extractUserEmailFromEventData(eventData);
          if (userEmail) {
            console.log('[WEBHOOK] Found user email in payment data:', userEmail);
            await handlePaymentSuccessForPlanChange(userEmail, transactionId, eventData);
          } else {
            console.log('[WEBHOOK] Could not find user email in payment data, skipping');
          }
          break;
        }
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

// Извлечь email из данных вебхука
function extractUserEmailFromEventData(eventData) {
  // Проверяем разные поля где может быть email
  if (eventData.Email) return eventData.Email;
  if (eventData.Description) {
    // Ищем email в описании (формат: "Подписка Studio для user@example.com")
    const emailMatch = eventData.Description.match(/[\w\.-]+@[\w\.-]+\.\w+/);
    if (emailMatch) return emailMatch[0];
  }
  if (eventData.CustomerReceipt?.Email) return eventData.CustomerReceipt.Email;
  if (eventData.Receipt?.Email) return eventData.Receipt.Email;
  
  return null;
}

// Resolve user by AccountId (which can be user.id or businessId) or by email
async function resolveUserFromAccountId(accountId, eventData) {
  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { id: accountId },
        { businessId: accountId }
      ]
    }
  });

  if (!user && eventData) {
    const email = extractUserEmailFromEventData(eventData);
    if (email) {
      user = await prisma.user.findUnique({
        where: { email }
      });
    }
  }

  return user;
}

// Обработка успешного платежа для смены тарифа (когда AccountId пустой)
async function handlePaymentSuccessForPlanChange(userEmail, transactionId, eventData) {
  console.log('[PAYMENT SUCCESS FOR PLAN CHANGE]', { userEmail, transactionId, eventData });

  try {
    // Находим пользователя по email
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      select: {
        id: true,
        email: true,
        cloudPaymentsCardToken: true,
        cloudPaymentsSubscriptionId: true
      }
    });

    if (!user) {
      console.log('[PLAN CHANGE] User not found by email:', userEmail);
      return;
    }

    console.log('[PLAN CHANGE] Found user:', {
      userId: user.id,
      email: user.email,
      hasCardToken: !!user.cloudPaymentsCardToken,
      subscriptionId: user.cloudPaymentsSubscriptionId
    });

    // Если у пользователя уже есть токен карты, не обновляем его
    if (user.cloudPaymentsCardToken) {
      console.log('[PLAN CHANGE] User already has card token, skipping update');
      return;
    }

    // Пытаемся получить токен карты из других данных
    // В идеале токен должен был сохраниться в changeSubscriptionPlan
    // Но если нет, то можем попробовать получить из других источников
    
    console.log('[PLAN CHANGE] User does not have card token, but payment was successful');
    console.log('[PLAN CHANGE] This might indicate an issue with token saving during plan change');
    
    // Здесь можно добавить дополнительную логику для восстановления токена
    // или уведомления администратора о проблеме
    
  } catch (error) {
    console.error('[PLAN CHANGE] Error processing payment success:', error);
  }
}

// Handle successful payment
async function handlePaymentSuccess(accountId, transactionId, eventData) {
  console.log('[PAYMENT SUCCESS]', { accountId, transactionId, eventData });

  // AccountId may be user.id (cloudPaymentsService flow) or user.businessId (createPayment flow)
  const user = await resolveUserFromAccountId(accountId, eventData);
  if (!user) {
    console.error('[PAYMENT SUCCESS] User not found for accountId:', accountId);
    return;
  }

  const businessId = user.businessId;
  if (!businessId) {
    console.error('[PAYMENT SUCCESS] User has no businessId:', user.id);
    return;
  }

  // CloudPayments sends Amount in rubles as string (e.g. "690.00")
  // Admin panel divides by 100, so store in kopecks
  const amountKopecks = Math.round(parseFloat(eventData.Amount || eventData.PaymentAmount || 0) * 100);

  // Update user payment stats so admin panel can display totals
  await prisma.user.update({
    where: { id: user.id },
    data: {
      totalPaid: { increment: amountKopecks },
      isPaying: true,
      lastPaymentAmount: amountKopecks,
      lastPaymentDate: new Date(),
      lastPaymentStatus: 'success',
      lastPaymentTransactionId: transactionId?.toString() || null
    }
  });

  console.log('[PAYMENT SUCCESS] Updated user payment stats:', {
    userId: user.id,
    businessId,
    amountKopecks
  });

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
    
    // Determine plan and maxUsers based on payment amount OR description
    let plan = 'SOLO';
    let maxUsers = 1;
    
    // First try to determine from amount (for real payments)
    if (eventData.Amount >= 1490) {
      plan = 'PRO';
      maxUsers = 15;
    } else if (eventData.Amount >= 990) {
      plan = 'STUDIO';
      maxUsers = 5;
    } else {
      // For test payments (Amount = 1.00), determine from Description
      if (eventData.Description && eventData.Description.includes('STUDIO')) {
        plan = 'STUDIO';
        maxUsers = 5;
      } else if (eventData.Description && eventData.Description.includes('PRO')) {
        plan = 'PRO';
        maxUsers = 15;
      } else {
        plan = 'SOLO';
        maxUsers = 1;
      }
    }
    
    console.log('[PAYMENT] Determined plan:', { 
      plan, 
      maxUsers, 
      amount: eventData.Amount,
      description: eventData.Description,
      method: parseFloat(eventData.Amount) >= 990 ? 'amount' : 'description'
    });
    
    // Set trial period for 5 days
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 5);
    
    // Set next payment date after trial ends (monthly billing)
    const nextPaymentDate = new Date(trialEndsAt);
    nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
    
    await prisma.subscription.create({
      data: {
        businessId,
        plan,
        maxUsers,
        usersLimit: maxUsers,
        subscriptionStatus: 'TRIAL',
        trialEndsAt,
        subscriptionEndsAt: nextPaymentDate,
        billingPeriod: 'MONTHLY',
        cloudpaymentsSubscriptionId: eventData.SubscriptionId || null,
        nextPaymentDate,
        isActive: true,
        cardAttachedAt: new Date(),
        lastPaymentAt: new Date(),
        autoRenewal: true
      }
    });

    console.log('[TRIAL SUBSCRIPTION ACTIVATED]', { 
      businessId, 
      trialEndsAt,
      nextPaymentDate,
      amount: eventData.Amount,
      subscriptionId: eventData.SubscriptionId,
      plan,
      maxUsers,
      message: '5-day trial subscription activated successfully'
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
    // Use upsert to handle duplicate cloudpaymentsSubscriptionId
    await prisma.subscription.upsert({
      where: { cloudpaymentsSubscriptionId: eventData.SubscriptionId },
      update: {
        cloudpaymentsSubscriptionId: eventData.SubscriptionId,
        lastPaymentAt: new Date(),
        cardAttachedAt: new Date()
      },
      create: {
        businessId,
        plan: 'SOLO', // Default plan, will be updated by webhook with correct amount
        maxUsers: 1,
        usersLimit: 1,
        subscriptionStatus: 'TRIAL',
        trialEndsAt: subscription.trialEndsAt,
        subscriptionEndsAt: subscription.subscriptionEndsAt,
        billingPeriod: 'MONTHLY',
        cloudpaymentsSubscriptionId: eventData.SubscriptionId,
        nextPaymentDate: subscription.trialEndsAt,
        isActive: true,
        cardAttachedAt: new Date(),
        lastPaymentAt: new Date(),
        autoRenewal: true
      }
    });
  }
}

// Handle payment confirmation
async function handlePaymentConfirm(accountId, transactionId, eventData) {
  console.log('[PAYMENT CONFIRM]', { accountId, transactionId });

  const user = await resolveUserFromAccountId(accountId, eventData);
  if (!user || !user.businessId) {
    console.error('[PAYMENT CONFIRM] User not found for accountId:', accountId);
    return;
  }

  const businessId = user.businessId;

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
async function handlePaymentFail(accountId, transactionId, eventData) {
  console.log('[PAYMENT FAILED]', { accountId, transactionId });

  const user = await resolveUserFromAccountId(accountId, eventData);
  if (!user || !user.businessId) {
    console.error('[PAYMENT FAILED] User not found for accountId:', accountId);
    return;
  }

  const businessId = user.businessId;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastPaymentStatus: 'failed',
      lastPaymentDate: new Date(),
      lastPaymentTransactionId: transactionId?.toString() || null
    }
  });

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
async function handleSubscriptionCancel(accountId, subscriptionId) {
  console.log('[SUBSCRIPTION CANCELLED]', { accountId, subscriptionId });

  const user = await resolveUserFromAccountId(accountId);
  if (!user || !user.businessId) {
    console.error('[SUBSCRIPTION CANCELLED] User not found for accountId:', accountId);
    return;
  }

  const businessId = user.businessId;

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
async function handleRecurrentPayment(accountId, subscriptionId, transactionId, eventData) {
  console.log('[RECURRING SUCCESS]', { accountId, subscriptionId, transactionId });

  const user = await resolveUserFromAccountId(accountId, eventData);
  if (!user || !user.businessId) {
    console.error('[RECURRING SUCCESS] User not found for accountId:', accountId);
    return;
  }

  const businessId = user.businessId;

  // Store amount in kopecks for admin panel
  const amountKopecks = Math.round(parseFloat(eventData.Amount || eventData.PaymentAmount || 0) * 100);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      totalPaid: { increment: amountKopecks },
      isPaying: true,
      lastPaymentAmount: amountKopecks,
      lastPaymentDate: new Date(),
      lastPaymentStatus: 'success',
      lastPaymentTransactionId: transactionId?.toString() || null
    }
  });

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
