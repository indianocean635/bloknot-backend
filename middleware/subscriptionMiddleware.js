const { prisma } = require('../services/prismaService');

/**
 * Middleware для проверки статуса подписки
 */
async function checkSubscriptionStatus(req, res, next) {
    try {
        console.log('[SUBSCRIPTION] Checking subscription status for user:', req.user?.id);
        
        if (!req.user) {
            console.log('[SUBSCRIPTION] No user found in request');
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Получаем актуальные данные пользователя
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                subscriptionStatus: true,
                subscriptionType: true,
                trialEndsAt: true,
                subscriptionEndsAt: true,
                nextPaymentDate: true,
                email: true,
                name: true
            }
        });

        if (!user) {
            console.log('[SUBSCRIPTION] User not found:', req.user.id);
            return res.status(404).json({ error: 'User not found' });
        }

        console.log('[SUBSCRIPTION] User subscription data:', {
            userId: user.id,
            status: user.subscriptionStatus,
            type: user.subscriptionType,
            trialEndsAt: user.trialEndsAt,
            subscriptionEndsAt: user.subscriptionEndsAt,
            nextPaymentDate: user.nextPaymentDate
        });

        // Проверяем и обновляем статус если нужно
        const updatedStatus = await updateSubscriptionStatusIfNeeded(user);
        
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
async function updateSubscriptionStatusIfNeeded(user) {
    const now = new Date();
    let updatedUser = { ...user };
    let needsUpdate = false;

    console.log('[SUBSCRIPTION] Checking if status update needed:', {
        currentStatus: user.subscriptionStatus,
        trialEndsAt: user.trialEndsAt,
        subscriptionEndsAt: user.subscriptionEndsAt,
        now: now.toISOString()
    });

    // Проверяем истечение trial периода
    if (user.subscriptionStatus === 'trial' && user.trialEndsAt && now > user.trialEndsAt) {
        console.log('[SUBSCRIPTION] Trial period expired');
        updatedUser.subscriptionStatus = 'expired';
        needsUpdate = true;
    }

    // Проверяем истечение подписки
    if ((user.subscriptionStatus === 'active' || user.subscriptionStatus === 'cancelled') && 
        user.subscriptionEndsAt && now > user.subscriptionEndsAt) {
        console.log('[SUBSCRIPTION] Subscription expired');
        updatedUser.subscriptionStatus = 'expired';
        needsUpdate = true;
    }

    // Обновляем в базе данных если нужно
    if (needsUpdate) {
        console.log('[SUBSCRIPTION] Updating user status in database');
        await prisma.user.update({
            where: { id: user.id },
            data: { subscriptionStatus: updatedUser.subscriptionStatus }
        });
    }

    // Определяем активность подписки
    const isActive = updatedUser.subscriptionStatus === 'trial' || updatedUser.subscriptionStatus === 'active';

    return {
        status: updatedUser.subscriptionStatus,
        type: updatedUser.subscriptionType,
        isActive,
        expiresAt: updatedUser.subscriptionEndsAt || updatedUser.trialEndsAt,
        trialEndsAt: updatedUser.trialEndsAt,
        nextPaymentDate: updatedUser.nextPaymentDate
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
                subscriptionStatus: true,
                subscriptionType: true,
                trialEndsAt: true,
                subscriptionEndsAt: true,
                nextPaymentDate: true,
                cloudPaymentsSubscriptionId: true,
                email: true,
                name: true
            }
        });

        if (!user) {
            throw new Error('User not found');
        }

        const updatedStatus = await updateSubscriptionStatusIfNeeded(user);

        return {
            status: updatedStatus.status,
            type: updatedStatus.type,
            isActive: updatedStatus.isActive,
            trialEndsAt: updatedStatus.trialEndsAt,
            subscriptionEndsAt: updatedStatus.expiresAt,
            nextPaymentDate: updatedStatus.nextPaymentDate,
            cloudPaymentsSubscriptionId: user.cloudPaymentsSubscriptionId,
            email: user.email,
            name: user.name
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
