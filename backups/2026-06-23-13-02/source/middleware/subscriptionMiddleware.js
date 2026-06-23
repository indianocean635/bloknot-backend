const { prisma } = require('../services/prismaService');

/**
 * Middleware для проверки статуса подписки
 */
async function checkSubscriptionStatus(req, res, next) {
    try {
        console.log('[SUBSCRIPTION] Checking subscription status for user:', req.user?.id, 'business:', req.user?.businessId);
        
        if (!req.user) {
            console.log('[SUBSCRIPTION] No user found in request');
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Получаем данные пользователя и подписки
        const [user, subscription] = await Promise.all([
            prisma.user.findUnique({
                where: { id: req.user.id },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    businessId: true
                }
            }),
            prisma.subscription.findUnique({
                where: { businessId: req.user.businessId }
            })
        ]);

        if (!user) {
            console.log('[SUBSCRIPTION] User not found:', req.user.id);
            return res.status(404).json({ error: 'User not found' });
        }

        console.log('[SUBSCRIPTION] Subscription data:', {
            userId: user.id,
            businessId: user.businessId,
            subscription: subscription ? {
                status: subscription.subscriptionStatus,
                plan: subscription.plan,
                trialEndsAt: subscription.trialEndsAt,
                subscriptionEndsAt: subscription.subscriptionEndsAt,
                nextPaymentDate: subscription.nextPaymentDate
            } : null
        });

        // Проверяем и обновляем статус если нужно
        const updatedStatus = await updateSubscriptionStatusIfNeeded(subscription);
        
        // Добавляем информацию о подписке в request
        req.subscription = {
            status: updatedStatus.status,
            type: updatedStatus.type,
            isActive: updatedStatus.isActive,
            expiresAt: updatedStatus.expiresAt,
            trialEndsAt: updatedStatus.trialEndsAt,
            nextPaymentDate: updatedStatus.nextPaymentDate
        };

        console.log('[SUBSCRIPTION] Final subscription status:', {
            userId: user.id,
            status: req.subscription.status,
            isActive: req.subscription.isActive
        });

        next();
    } catch (error) {
        console.error('[SUBSCRIPTION] Error checking subscription status:', error);
        res.status(500).json({ error: 'Subscription check failed' });
    }
}

/**
 * Middleware для ограничения доступа при истекшей подписке
 */
function requireActiveSubscription(req, res, next) {
    console.log('[SUBSCRIPTION] Checking active subscription requirement');
    
    if (!req.subscription) {
        console.log('[SUBSCRIPTION] No subscription data found');
        return res.status(403).json({ 
            error: 'Subscription check failed',
            code: 'SUBSCRIPTION_CHECK_FAILED'
        });
    }

    if (!req.subscription.isActive) {
        console.log('[SUBSCRIPTION] Access denied - subscription not active:', {
            status: req.subscription.status,
            userId: req.user?.id
        });
        
        return res.status(403).json({ 
            error: 'Subscription required',
            code: 'SUBSCRIPTION_EXPIRED',
            message: 'Онлайн-запись временно недоступна. Владелец аккаунта не продлил подписку.',
            subscriptionStatus: req.subscription.status
        });
    }

    console.log('[SUBSCRIPTION] Access granted - subscription active');
    next();
}

/**
 * Обновление статуса подписки если необходимо
 */
async function updateSubscriptionStatusIfNeeded(subscription) {
    const now = new Date();
    
    // Если нет подписки, возвращаем статус без подписки
    if (!subscription) {
        return {
            status: 'none',
            type: null,
            isActive: false,
            expiresAt: null,
            trialEndsAt: null,
            nextPaymentDate: null
        };
    }

    let updatedSubscription = { ...subscription };
    let needsUpdate = false;

    console.log('[SUBSCRIPTION] Checking if status update needed:', {
        currentStatus: subscription.subscriptionStatus,
        trialEndsAt: subscription.trialEndsAt,
        subscriptionEndsAt: subscription.subscriptionEndsAt,
        now: now.toISOString()
    });

    // Проверяем истечение trial периода
    if (subscription.subscriptionStatus === 'TRIAL' && subscription.trialEndsAt && now > subscription.trialEndsAt) {
        console.log('[SUBSCRIPTION] Trial period expired');
        updatedSubscription.subscriptionStatus = 'EXPIRED';
        needsUpdate = true;
    }

    // Проверяем истечение подписки
    if ((subscription.subscriptionStatus === 'ACTIVE' || subscription.subscriptionStatus === 'CANCELLED') && 
        subscription.subscriptionEndsAt && now > subscription.subscriptionEndsAt) {
        console.log('[SUBSCRIPTION] Subscription expired');
        updatedSubscription.subscriptionStatus = 'EXPIRED';
        needsUpdate = true;
    }

    // Обновляем в базе данных если нужно
    if (needsUpdate) {
        console.log('[SUBSCRIPTION] Updating subscription status in database');
        await prisma.subscription.update({
            where: { id: subscription.id },
            data: { subscriptionStatus: updatedSubscription.subscriptionStatus }
        });
    }

    // Определяем активность подписки
    // TRIAL и ACTIVE считаются активными, если срок действия не истек
    let isActive = true;
    
    if (updatedSubscription.subscriptionStatus === 'TRIAL') {
        // TRIAL всегда считаем активным (демо режим должен работать полностью)
        console.log('[SUBSCRIPTION] TRIAL status detected - setting active');
        isActive = true;
        
        // Проверяем не истек ли TRIAL период - если истек, подписка должна быть ACTIVE
        if (updatedSubscription.trialEndsAt && now > updatedSubscription.trialEndsAt) {
            console.log('[SUBSCRIPTION] TRIAL expired, should be ACTIVE - checking auto-renewal');
            // Если есть autoRenewal, подписка должна быть ACTIVE
            if (updatedSubscription.autoRenewal) {
                console.log('[SUBSCRIPTION] Auto-renewal enabled, subscription should be ACTIVE');
                isActive = true;
            }
        }
    } else if (updatedSubscription.subscriptionStatus === 'ACTIVE') {
        // ACTIVE активен, если дата окончания еще не наступила
        isActive = !updatedSubscription.subscriptionEndsAt || now <= updatedSubscription.subscriptionEndsAt;
    }
    
    console.log('[SUBSCRIPTION] Subscription activity determined:', {
        status: updatedSubscription.subscriptionStatus,
        isActive,
        trialEndsAt: updatedSubscription.trialEndsAt,
        subscriptionEndsAt: updatedSubscription.subscriptionEndsAt,
        now: now.toISOString()
    });

    return {
        status: updatedSubscription.subscriptionStatus,
        type: updatedSubscription.plan,
        isActive,
        expiresAt: updatedSubscription.subscriptionEndsAt || updatedSubscription.trialEndsAt,
        trialEndsAt: updatedSubscription.trialEndsAt,
        nextPaymentDate: updatedSubscription.nextPaymentDate
    };
}

/**
 * Получение информации о подписке
 */
async function getSubscriptionInfo(userId) {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                businessId: true
            }
        });

        if (!user) {
            throw new Error('User not found');
        }

        const subscription = await prisma.subscription.findUnique({
            where: { businessId: user.businessId }
        });

        const updatedStatus = await updateSubscriptionStatusIfNeeded(subscription);

        return {
            status: updatedStatus.status,
            type: updatedStatus.type,
            isActive: updatedStatus.isActive,
            trialEndsAt: updatedStatus.trialEndsAt,
            subscriptionEndsAt: updatedStatus.expiresAt,
            nextPaymentDate: updatedStatus.nextPaymentDate,
            cloudPaymentsSubscriptionId: subscription?.cloudpaymentsSubscriptionId,
            email: user.email,
            name: user.name,
            plan: subscription?.plan,
            maxUsers: subscription?.maxUsers,
            usersLimit: subscription?.usersLimit
        };
    } catch (error) {
        console.error('[SUBSCRIPTION] Error getting subscription info:', error);
        throw error;
    }
}

module.exports = {
    checkSubscriptionStatus,
    requireActiveSubscription,
    getSubscriptionInfo,
    updateSubscriptionStatusIfNeeded
};
