const { prisma } = require('./prismaService');

// Автоматическое конвертирование TRIAL в платную подписку с Grace Period
async function convertTrialToPaidSubscription() {
  console.log('[AUTO PAYMENT] Checking trial subscriptions for conversion...');
  
  try {
    const now = new Date();
    
    // Найти все TRIAL подписки, которые должны конвертироваться сегодня
    const trialSubscriptions = await prisma.subscription.findMany({
      where: {
        subscriptionStatus: 'TRIAL',
        trialEndsAt: {
          lte: now // trialEndsAt <= сейчас
        },
        autoRenewal: true,
        cloudpaymentsSubscriptionId: {
          not: null
        }
      },
      include: {
        business: true
      }
    });
    
    console.log(`[AUTO PAYMENT] Found ${trialSubscriptions.length} trial subscriptions to convert`);
    
    for (const subscription of trialSubscriptions) {
      try {
        console.log(`[AUTO PAYMENT] Converting trial to paid for business: ${subscription.businessId}`);
        
        // Определить цену тарифа
        const planPrice = subscription.plan === 'SOLO' ? 690 : subscription.plan === 'STUDIO' ? 990 : 1490; // SOLO: 690р, STUDIO: 990р, PRO: 1490р
        
        // Обновить подписку до платной
        const updatedSubscription = await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            subscriptionStatus: 'ACTIVE',
            trialEndsAt: null, // Очистить дату окончания TRIAL
            subscriptionEndsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // +30 дней
            nextPaymentDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // +30 дней
            convertedToPaidAt: new Date(),
            lastPaymentAt: new Date(),
            lastPaymentAmount: planPrice
          }
        });
        
        console.log(`[AUTO PAYMENT] Successfully converted trial to paid: ${subscription.businessId}`);
        
        // Записать транзакцию
        await prisma.transaction.create({
          data: {
            businessId: subscription.businessId,
            amount: planPrice,
            currency: 'RUB',
            status: 'COMPLETED',
            paymentMethod: 'AUTOMATIC',
            description: `Автоматическое продление подписки ${subscription.plan}`,
            subscriptionId: subscription.id
          }
        });
        
        console.log(`[AUTO PAYMENT] Payment transaction recorded: ${subscription.businessId}`);
        
      } catch (error) {
        console.error(`[AUTO PAYMENT] Error converting trial to paid for business ${subscription.businessId}:`, error);
      }
    }
    
    console.log('[AUTO PAYMENT] Trial conversion process completed');
    
  } catch (error) {
    console.error('[AUTO PAYMENT] Error in trial conversion process:', error);
  }
}

// Автоматическое продление платных подписок
async function renewPaidSubscriptions() {
  console.log('[AUTO PAYMENT] Checking paid subscriptions for renewal...');
  
  try {
    const now = new Date();
    
    // Найти все платные подписки, которые нужно продлить сегодня
    const paidSubscriptions = await prisma.subscription.findMany({
      where: {
        subscriptionStatus: 'ACTIVE',
        nextPaymentDate: {
          lte: now // nextPaymentDate <= сейчас
        },
        autoRenewal: true,
        cloudpaymentsSubscriptionId: {
          not: null
        }
      },
      include: {
        business: true
      }
    });
    
    console.log(`[AUTO PAYMENT] Found ${paidSubscriptions.length} paid subscriptions to renew`);
    
    for (const subscription of paidSubscriptions) {
      try {
        console.log(`[AUTO PAYMENT] Renewing paid subscription for business: ${subscription.businessId}`);
        
        // Определить цену тарифа
        const planPrice = subscription.plan === 'SOLO' ? 690 : subscription.plan === 'STUDIO' ? 990 : 1490;
        
        // Продлить подписку
        const updatedSubscription = await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            subscriptionEndsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // +30 дней
            nextPaymentDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // +30 дней
            lastPaymentAt: new Date(),
            lastPaymentAmount: planPrice
          }
        });
        
        console.log(`[AUTO PAYMENT] Successfully renewed paid subscription: ${subscription.businessId}`);
        
        // Записать транзакцию
        await prisma.transaction.create({
          data: {
            businessId: subscription.businessId,
            amount: planPrice,
            currency: 'RUB',
            status: 'COMPLETED',
            paymentMethod: 'AUTOMATIC',
            description: `Автоматическое продление подписки ${subscription.plan}`,
            subscriptionId: subscription.id
          }
        });
        
        console.log(`[AUTO PAYMENT] Payment transaction recorded: ${subscription.businessId}`);
        
      } catch (error) {
        console.error(`[AUTO PAYMENT] Error renewing paid subscription for business ${subscription.businessId}:`, error);
      }
    }
    
    console.log('[AUTO PAYMENT] Paid renewal process completed');
    
  } catch (error) {
    console.error('[AUTO PAYMENT] Error in paid renewal process:', error);
  }
}

// Основная функция для обработки всех автоматических платежей
async function processAutoPayments() {
  console.log('[AUTO PAYMENT] Starting automatic payment processing...');
  
  try {
    // 1. Конвертировать TRIAL в платные подписки
    await convertTrialToPaidSubscription();
    
    // 2. Продлить платные подписки
    await renewPaidSubscriptions();
    
    // 3. Обработать Grace Period
    await handleGracePeriod();
    
    console.log('[AUTO PAYMENT] Automatic payment processing completed successfully');
    
  } catch (error) {
    console.error('[AUTO PAYMENT] Error in automatic payment processing:', error);
  }
}

// Обработка Grace Period
async function handleGracePeriod() {
  console.log('[AUTO PAYMENT] Checking grace period subscriptions...');
  
  try {
    const now = new Date();
    
    // Найти все подписки в Grace Period, которые истекают сегодня
    const gracePeriodSubscriptions = await prisma.subscription.findMany({
      where: {
        subscriptionStatus: 'grace_period',
        gracePeriodEndsAt: {
          lte: now // gracePeriodEndsAt <= сейчас
        }
      },
      include: {
        business: true
      }
    });
    
    console.log(`[AUTO PAYMENT] Found ${gracePeriodSubscriptions.length} grace period subscriptions to expire`);
    
    for (const subscription of gracePeriodSubscriptions) {
      try {
        console.log(`[AUTO PAYMENT] Expiring grace period for business: ${subscription.businessId}`);
        
        // Отключить подписку
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            subscriptionStatus: 'expired',
            isActive: false
          }
        });
        
        console.log(`[AUTO PAYMENT] Grace period expired: ${subscription.businessId}`);
        
      } catch (error) {
        console.error(`[AUTO PAYMENT] Error expiring grace period for business ${subscription.businessId}:`, error);
      }
    }
    
    console.log('[AUTO PAYMENT] Grace period handling completed');
    
  } catch (error) {
    console.error('[AUTO PAYMENT] Error in grace period handling:', error);
  }
}

module.exports = {
  convertTrialToPaidSubscription,
  renewPaidSubscriptions,
  handleGracePeriod,
  processAutoPayments
};
