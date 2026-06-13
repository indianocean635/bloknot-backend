const cloudPaymentsService = require('../services/cloudPaymentsService');
const { getSubscriptionInfo } = require('../middleware/subscriptionMiddleware');

/**
 * Получение информации о подписке
 */
async function getCloudSubscriptionInfo(req, res) {
    try {
        console.log('[SUBSCRIPTION] Getting subscription info for user:', req.user?.id);

        const subscriptionInfo = await getSubscriptionInfo(req.user.id);

        console.log('[SUBSCRIPTION] Subscription info retrieved:', {
            userId: req.user.id,
            status: subscriptionInfo.status,
            type: subscriptionInfo.type,
            isActive: subscriptionInfo.isActive
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
            hasCardToken: !!req.body.cardToken
        });

        const { subscriptionType, cardToken, userEmail, userName } = req.body;

        if (!subscriptionType || !['monthly', 'yearly'].includes(subscriptionType)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid subscription type. Must be monthly or yearly'
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
            userNameToUse
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
                id: 'monthly',
                name: 'Месячный тариф',
                price: '990 ₽',
                period: 'месяц',
                trialDays: 5,
                description: '5 дней бесплатно, затем 990 ₽ в месяц',
                features: [
                    'Неограниченное количество записей',
                    'Онлайн-запись для клиентов',
                    'Уведомления в WhatsApp, Telegram, VK',
                    'Управление специалистами',
                    'Аналитика и отчеты'
                ]
            },
            {
                id: 'yearly',
                name: 'Годовой тариф',
                price: '9 900 ₽',
                period: 'год',
                trialDays: 0,
                description: 'Оплата за год, экономия 17%',
                features: [
                    'Все функции месячного тарифа',
                    'Экономия 17% по сравнению с ежемесячной оплатой',
                    'Приоритетная поддержка',
                    'Доступ к новым функциям в первую очередь'
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

module.exports = {
    getCloudSubscriptionInfo,
    createSubscription,
    cancelSubscription,
    getSubscriptionPlans,
    updatePaymentMethod,
    getPaymentHistory
};
