const crypto = require('crypto');
const axios = require('axios');

class CloudPaymentsService {
    constructor() {
        this.publicId = process.env.CLOUDPAYMENTS_PUBLIC_ID;
        this.privateKey = process.env.CLOUDPAYMENTS_PRIVATE_KEY;
        this.apiBaseUrl = 'https://api.cloudpayments.ru';
        
        console.log('[CLOUDPAYMENTS] Service initialized', {
            hasPublicId: !!this.publicId,
            hasPrivateKey: !!this.privateKey,
            apiBaseUrl: this.apiBaseUrl
        });
    }

    /**
     * Создание подписки
     */
    async createSubscription(userId, cardToken, subscriptionType, userEmail, userName) {
        try {
            console.log('[CLOUDPAYMENTS] Creating subscription:', {
                userId,
                subscriptionType,
                userEmail,
                hasCardToken: !!cardToken
            });

            const { prisma } = require('../services/prismaService');
            
            // Получаем данные пользователя
            const user = await prisma.user.findUnique({
                where: { id: userId },
                include: { business: true }
            });

            if (!user) {
                throw new Error('User not found');
            }

            // Определяем параметры подписки
            const subscriptionConfig = this.getSubscriptionConfig(subscriptionType);
            const now = new Date();
            
            let trialEndsAt = null;
            let subscriptionEndsAt = null;
            let firstPaymentAmount = 0;

            // Для месячной подписки с пробным периодом
            if (subscriptionType === 'monthly') {
                trialEndsAt = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 дней
                subscriptionEndsAt = new Date(now.getTime() + 35 * 24 * 60 * 60 * 1000); // 35 дней (5 trial + 30 first month)
                firstPaymentAmount = 0; // Бесплатный период
            } else if (subscriptionType === 'yearly') {
                subscriptionEndsAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 365 дней
                firstPaymentAmount = subscriptionConfig.amount;
            }

            // Создаем подписку в CloudPayments
            const cloudPaymentsData = {
                Token: cardToken,
                AccountId: userId,
                Email: userEmail,
                Description: `Подписка ${subscriptionConfig.name} для ${user.business?.name || userName}`,
                Amount: firstPaymentAmount,
                Currency: 'RUB',
                RequireConfirmation: false,
                StartDate: trialEndsAt || now,
                Period: subscriptionType === 'monthly' ? 30 : 365,
                Interval: 'Day',
                MaxPeriods: subscriptionType === 'monthly' ? 12 : 1,
                CustomerReceipt: {
                    Items: [{
                        Label: subscriptionConfig.name,
                        Price: subscriptionConfig.amount * 100, // в копейках
                        Quantity: 1,
                        Amount: subscriptionConfig.amount * 100,
                        Vat: 20,
                        PaymentMethodType: 1,
                        PaymentObject: 1
                    }],
                    TaxationSystem: 2,
                    Email: userEmail
                }
            };

            console.log('[CLOUDPAYMENTS] Sending subscription request:', {
                ...cloudPaymentsData,
                Token: cardToken ? 'SET' : 'MISSING'
            });

            const response = await this.makeRequest('/subscriptions/create', cloudPaymentsData);

            if (response.Success) {
                console.log('[CLOUDPAYMENTS] Subscription created successfully:', {
                    subscriptionId: response.Model.Id,
                    status: response.Model.Status
                });

                // Обновляем данные пользователя
                await prisma.user.update({
                    where: { id: userId },
                    data: {
                        subscriptionStatus: trialEndsAt ? 'trial' : 'active',
                        subscriptionType,
                        trialEndsAt,
                        subscriptionEndsAt,
                        cloudPaymentsSubscriptionId: response.Model.Id.toString(),
                        cloudPaymentsCardToken: cardToken,
                        nextPaymentDate: trialEndsAt || subscriptionEndsAt
                    }
                });

                return {
                    success: true,
                    subscriptionId: response.Model.Id,
                    status: response.Model.Status,
                    trialEndsAt,
                    subscriptionEndsAt,
                    nextPaymentDate: trialEndsAt || subscriptionEndsAt
                };
            } else {
                console.error('[CLOUDPAYMENTS] Subscription creation failed:', response);
                throw new Error(response.Message || 'Failed to create subscription');
            }
        } catch (error) {
            console.error('[CLOUDPAYMENTS] Error creating subscription:', error);
            throw error;
        }
    }

    /**
     * Отмена подписки
     */
    async cancelSubscription(userId) {
        try {
            console.log('[CLOUDPAYMENTS] Cancelling subscription:', { userId });

            const { prisma } = require('../services/prismaService');
            
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    cloudPaymentsSubscriptionId: true,
                    subscriptionStatus: true,
                    subscriptionEndsAt: true
                }
            });

            if (!user || !user.cloudPaymentsSubscriptionId) {
                throw new Error('Subscription not found');
            }

            // Отменяем в CloudPayments
            const response = await this.makeRequest('/subscriptions/cancel', {
                Id: user.cloudPaymentsSubscriptionId
            });

            if (response.Success) {
                console.log('[CLOUDPAYMENTS] Subscription cancelled successfully');

                // Обновляем статус - не отключаем сразу, а помечаем как отмененную
                await prisma.user.update({
                    where: { id: userId },
                    data: {
                        subscriptionStatus: 'cancelled'
                    }
                });

                return {
                    success: true,
                    message: 'Подписка отменена. Доступ останется активным до ' + 
                           (user.subscriptionEndsAt ? user.subscriptionEndsAt.toLocaleDateString('ru-RU') : 'окончания периода')
                };
            } else {
                throw new Error(response.Message || 'Failed to cancel subscription');
            }
        } catch (error) {
            console.error('[CLOUDPAYMENTS] Error cancelling subscription:', error);
            throw error;
        }
    }

    /**
     * Обработка webhook от CloudPayments
     */
    async handleWebhook(req, res) {
        try {
            console.log('[CLOUDPAYMENTS] Processing webhook');

            // Проверяем подпись
            if (!this.verifyWebhookSignature(req)) {
                console.error('[CLOUDPAYMENTS] Invalid webhook signature');
                return res.status(400).json({ error: 'Invalid signature' });
            }

            const { Type, Model, Reason } = req.body;
            console.log('[CLOUDPAYMENTS] Webhook data:', { Type, Reason });

            const { prisma } = require('../services/prismaService');

            switch (Type) {
                case 'Subscription':
                    await this.handleSubscriptionWebhook(Model, Reason, prisma);
                    break;
                case 'Payment':
                    await this.handlePaymentWebhook(Model, Reason, prisma);
                    break;
                default:
                    console.log('[CLOUDPAYMENTS] Unknown webhook type:', Type);
            }

            res.json({ success: true });
        } catch (error) {
            console.error('[CLOUDPAYMENTS] Webhook processing error:', error);
            res.status(500).json({ error: 'Webhook processing failed' });
        }
    }

    /**
     * Обработка webhook для подписок
     */
    async handleSubscriptionWebhook(model, reason, prisma) {
        console.log('[CLOUDPAYMENTS] Handling subscription webhook:', { reason, model });

        const subscriptionId = model.Id?.toString();
        const accountId = model.AccountId;

        if (!subscriptionId || !accountId) {
            console.error('[CLOUDPAYMENTS] Invalid subscription webhook data');
            return;
        }

        const user = await prisma.user.findUnique({
            where: { id: accountId }
        });

        if (!user) {
            console.error('[CLOUDPAYMENTS] User not found for subscription:', accountId);
            return;
        }

        switch (reason) {
            case 'Success':
                // Успешное продление подписки
                console.log('[CLOUDPAYMENTS] Subscription renewal successful');
                await prisma.user.update({
                    where: { id: accountId },
                    data: {
                        subscriptionStatus: 'active',
                        subscriptionEndsAt: new Date(model.NextTransactionDate)
                    }
                });
                break;

            case 'Fail':
                // Неудачное продление
                console.log('[CLOUDPAYMENTS] Subscription renewal failed');
                await prisma.user.update({
                    where: { id: accountId },
                    data: {
                        subscriptionStatus: 'expired'
                    }
                });
                break;

            case 'Cancel':
                // Отмена подписки
                console.log('[CLOUDPAYMENTS] Subscription cancelled');
                await prisma.user.update({
                    where: { id: accountId },
                    data: {
                        subscriptionStatus: 'cancelled'
                    }
                });
                break;

            default:
                console.log('[CLOUDPAYMENTS] Unknown subscription webhook reason:', reason);
        }
    }

    /**
     * Обработка webhook для платежей
     */
    async handlePaymentWebhook(model, reason, prisma) {
        console.log('[CLOUDPAYMENTS] Handling payment webhook:', { reason, model });
        
        const accountId = model.AccountId;
        const amount = model.Amount;

        if (!accountId) {
            console.error('[CLOUDPAYMENTS] Invalid payment webhook data');
            return;
        }

        // Обновляем общую сумму платежей
        if (reason === 'Success') {
            await prisma.user.update({
                where: { id: accountId },
                data: {
                    totalPaid: { increment: amount },
                    isPaying: true
                }
            });

            console.log('[CLOUDPAYMENTS] Payment successful, updated totals:', {
                accountId,
                amount,
                totalPaid: amount
            });
        }
    }

    /**
     * Проверка подписи webhook
     */
    verifyWebhookSignature(req) {
        try {
            const signature = req.get('Content-HMAC');
            if (!signature) {
                console.error('[CLOUDPAYMENTS] No signature in webhook request');
                return false;
            }

            const body = JSON.stringify(req.body);
            const expectedSignature = crypto
                .createHmac('sha256', this.privateKey)
                .update(body)
                .digest('hex');

            const isValid = signature === expectedSignature;
            console.log('[CLOUDPAYMENTS] Signature verification:', { isValid });
            
            return isValid;
        } catch (error) {
            console.error('[CLOUDPAYMENTS] Signature verification error:', error);
            return false;
        }
    }

    /**
     * Выполнение запроса к API CloudPayments
     */
    async makeRequest(endpoint, data) {
        try {
            const auth = Buffer.from(`${this.publicId}:${this.privateKey}`).toString('base64');
            
            const response = await axios.post(`${this.apiBaseUrl}${endpoint}`, data, {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('[CLOUDPAYMENTS] API response:', {
                endpoint,
                success: response.data.Success,
                status: response.status
            });

            return response.data;
        } catch (error) {
            console.error('[CLOUDPAYMENTS] API request error:', {
                endpoint,
                status: error.response?.status,
                data: error.response?.data
            });
            throw error;
        }
    }

    /**
     * Получение конфигурации тарифа
     */
    getSubscriptionConfig(type) {
        const configs = {
            monthly: {
                name: 'Месячный тариф',
                amount: 990, // 990 рублей
                description: 'Ежемесячная подписка с 5 днями бесплатного периода'
            },
            yearly: {
                name: 'Годовой тариф',
                amount: 9900, // 9900 рублей
                description: 'Годовая подписка со скидкой 17%'
            }
        };

        const config = configs[type];
        if (!config) {
            throw new Error(`Unknown subscription type: ${type}`);
        }

        return config;
    }
}

// Создаем singleton экземпляр
const cloudPaymentsService = new CloudPaymentsService();

module.exports = cloudPaymentsService;
