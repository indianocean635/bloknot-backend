const cloudPaymentsService = require('../services/cloudPaymentsService');
const { getSubscriptionInfo } = require('../middleware/subscriptionMiddleware');

/**
 * Получение информации о подписке
 */
async function getCloudSubscriptionInfo(req, res) {
    try {
        console.log('[SUBSCRIPTION] Getting subscription info for user:', req.user?.id, 'business:', req.user?.businessId);

        const subscriptionInfo = await getSubscriptionInfo(req.user.id);

        console.log('[SUBSCRIPTION] Subscription info retrieved:', {
            userId: req.user.id,
            businessId: req.user.businessId,
            status: subscriptionInfo.status,
            type: subscriptionInfo.type,
            isActive: subscriptionInfo.isActive,
            plan: subscriptionInfo.plan
        });

        res.json({
            success: true,
            data: subscriptionInfo
        });
    } catch (error) {
        console.error('[SUBSCRIPTION] Error getting subscription info:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get subscription info'
        });
    }
}

/**
 * Создание подписки
 */
async function createSubscription(req, res) {
    try {
        console.log('[SUBSCRIPTION] Creating subscription request:', {
            userId: req.user?.id,
            subscriptionType: req.body.subscriptionType,
            hasCardToken: !!req.body.cardToken,
            getDataOnly: req.body.getDataOnly
        });

        const { subscriptionType, cardToken, userEmail, userName, planId, planName, planAmount, getDataOnly } = req.body;

        if (!subscriptionType || !['monthly', 'yearly'].includes(subscriptionType)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid subscription type. Must be monthly or yearly'
            });
        }

        // If getDataOnly flag is set, return payment data without creating subscription
        if (getDataOnly) {
            console.log('[SUBSCRIPTION] Getting payment data only, not creating subscription');
            
            const cloudPaymentsData = await cloudPaymentsService.getPaymentData(subscriptionType, {
                planId,
                planName,
                planAmount,
                userEmail: userEmail || req.user.email,
                userName: userName || req.user.name || 'User'
            });

            return res.json({
                success: true,
                cloudPayments: cloudPaymentsData
            });
        }

        if (!cardToken) {
            return res.status(400).json({
                success: false,
                error: 'Card token is required'
            });
        }

        const userEmailToUse = userEmail || req.user.email;
        const userNameToUse = userName || req.user.name || 'User';

        const result = await cloudPaymentsService.createSubscription(
            req.user.id,
            cardToken,
            subscriptionType,
            userEmailToUse,
            userNameToUse,
            planId,
            planName,
            planAmount
        );

        console.log('[SUBSCRIPTION] Subscription created successfully:', {
            userId: req.user.id,
            subscriptionId: result.subscriptionId,
            subscriptionType,
            trialEndsAt: result.trialEndsAt,
            subscriptionEndsAt: result.subscriptionEndsAt
        });

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('[SUBSCRIPTION] Error creating subscription:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create subscription'
        });
    }
}

/**
 * Отмена подписки
 */
async function cancelSubscription(req, res) {
    try {
        console.log('[SUBSCRIPTION] Cancelling subscription for user:', req.user?.id);

        const result = await cloudPaymentsService.cancelSubscription(req.user.id);

        console.log('[SUBSCRIPTION] Subscription cancelled successfully:', {
            userId: req.user.id,
            message: result.message
        });

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('[SUBSCRIPTION] Error cancelling subscription:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to cancel subscription'
        });
    }
}

/**
 * Получение доступных тарифов
 */
async function getSubscriptionPlans(req, res) {
    try {
        console.log('[SUBSCRIPTION] Getting subscription plans');

        const plans = [
            {
                id: 'solo-monthly',
                name: 'Solo',
                price: '690 ₽',
                period: 'месяц',
                billingType: 'monthly',
                trialDays: 5,
                description: '1 пользователь',
                yearlyPrice: '5 520 ₽',
                yearlyDiscount: '20%',
                features: [
                    'Неограниченное количество записей',
                    'Онлайн-запись клиентов',
                    'Управление услугами',
                    'Продвинутая аналитика',
                    'Персональный менеджер',
                    'Экспорт данных',
                    'Кастомизация бренда',
                    'Напоминания о записи в Telegram'
                ]
            },
            {
                id: 'studio-monthly',
                name: 'Studio',
                price: '990 ₽',
                period: 'месяц',
                billingType: 'monthly',
                trialDays: 5,
                description: 'До 5 пользователей',
                yearlyPrice: '7 920 ₽',
                yearlyDiscount: '20%',
                features: [
                    'Неограниченное количество записей',
                    'Онлайн-запись клиентов',
                    'Управление услугами',
                    'Продвинутая аналитика',
                    'Персональный менеджер',
                    'Экспорт данных',
                    'Кастомизация бренда',
                    'Напоминания о записи в Telegram'
                ]
            },
            {
                id: 'pro-monthly',
                name: 'Pro',
                price: '1 490 ₽',
                period: 'месяц',
                billingType: 'monthly',
                trialDays: 5,
                description: 'Более 5 пользователей',
                yearlyPrice: '11 920 ₽',
                yearlyDiscount: '20%',
                features: [
                    'Неограниченное количество записей',
                    'Онлайн-запись клиентов',
                    'Управление услугами',
                    'Продвинутая аналитика',
                    'Персональный менеджер',
                    'Экспорт данных',
                    'Кастомизация бренда',
                    'Напоминания о записи в Telegram'
                ]
            }
        ];

        res.json({
            success: true,
            data: plans
        });
    } catch (error) {
        console.error('[SUBSCRIPTION] Error getting subscription plans:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get subscription plans'
        });
    }
}

/**
 * Обновление способа оплаты
 */
async function updatePaymentMethod(req, res) {
    try {
        console.log('[SUBSCRIPTION] Updating payment method for user:', req.user?.id);

        const { cardToken } = req.body;

        if (!cardToken) {
            return res.status(400).json({
                success: false,
                error: 'Card token is required'
            });
        }

        const { prisma } = require('../services/prismaService');

        await prisma.user.update({
            where: { id: req.user.id },
            data: { cloudPaymentsCardToken: cardToken }
        });

        console.log('[SUBSCRIPTION] Payment method updated successfully:', {
            userId: req.user.id
        });

        res.json({
            success: true,
            message: 'Способ оплаты обновлен'
        });
    } catch (error) {
        console.error('[SUBSCRIPTION] Error updating payment method:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update payment method'
        });
    }
}

/**
 * Получение истории платежей
 */
async function getPaymentHistory(req, res) {
    try {
        console.log('[SUBSCRIPTION] Getting payment history for user:', req.user?.id);

        const { prisma } = require('../services/prismaService');

        // Получаем информацию о пользователе
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                totalPaid: true,
                isPaying: true,
                subscriptionType: true,
                subscriptionStatus: true,
                createdAt: true
            }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Формируем историю платежей (в реальном проекте здесь была бы таблица с платежами)
        const paymentHistory = [
            {
                id: 'summary',
                type: 'summary',
                amount: user.totalPaid,
                date: user.createdAt,
                status: 'completed',
                description: `Общая сумма платежей за все время`
            }
        ];

        // Если есть активная подписка, добавляем информацию о ней
        if (user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trial') {
            const planConfig = {
                monthly: { amount: 990, name: 'Месячный тариф' },
                yearly: { amount: 9900, name: 'Годовой тариф' }
            };

            const plan = planConfig[user.subscriptionType];
            if (plan) {
                paymentHistory.push({
                    id: 'current',
                    type: 'subscription',
                    amount: plan.amount,
                    date: new Date(),
                    status: user.subscriptionStatus === 'trial' ? 'trial' : 'active',
                    description: plan.name,
                    isRecurring: true
                });
            }
        }

        res.json({
            success: true,
            data: {
                totalPaid: user.totalPaid,
                isPaying: user.isPaying,
                history: paymentHistory
            }
        });
    } catch (error) {
        console.error('[SUBSCRIPTION] Error getting payment history:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get payment history'
        });
    }
}

/**
 * Смена тарифа для существующего клиента
 */
async function changeSubscriptionPlan(req, res) {
    try {
        console.log('[SUBSCRIPTION] Changing subscription plan for user:', req.user?.id);

        const { subscriptionType, cardToken, planId, planName, planAmount } = req.body;

        if (!subscriptionType || !cardToken || !planId || !planName || !planAmount) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: subscriptionType, cardToken, planId, planName, planAmount'
            });
        }

        const result = await cloudPaymentsService.changeSubscriptionPlan(
            req.user.id,
            cardToken,
            subscriptionType,
            req.user.email,
            req.user.name,
            planId,
            planName,
            planAmount
        );

        console.log('[SUBSCRIPTION] Plan change successful:', {
            userId: req.user.id,
            newPlan: planName,
            subscriptionId: result.subscriptionId,
            hasCloudPayments: !!result.cloudPayments
        });

        res.json({
            success: true,
            data: result,
            message: `Тариф успешно изменен на ${planName}`
        });
    } catch (error) {
        console.error('[SUBSCRIPTION] Error changing subscription plan:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to change subscription plan'
        });
    }
}

module.exports = {
    getCloudSubscriptionInfo,
    createSubscription,
    changeSubscriptionPlan,
    cancelSubscription,
    getSubscriptionPlans,
    updatePaymentMethod,
    getPaymentHistory
};
