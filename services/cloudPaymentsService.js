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
     * Создание подписки с правильной логикой Trial
     */
    async createSubscription(userId, cardToken, subscriptionType, userEmail, userName, planId, planName, planAmount) {
        try {
            console.log('[CLOUDPAYMENTS] Creating subscription:', {
                userId,
                subscriptionType,
                userEmail,
                planId,
                planName,
                planAmount,
                hasCardToken: !!cardToken
            });

            const { prisma } = require('../services/prismaService');
            
            // Получаем данные пользователя с существующей подпиской
            const user = await prisma.user.findUnique({
                where: { id: userId },
                include: { business: true }
            });

            if (!user) {
                throw new Error('User not found');
            }

            // Проверяем существующую подписку
            const existingSubscription = await prisma.subscription.findUnique({
                where: { businessId: user.businessId }
            });

            // Определяем параметры подписки на основе planId
            const subscriptionConfig = this.getSubscriptionConfig(planId);
            const now = new Date();
            
            let trialEndsAt = null;
            let subscriptionEndsAt = null;
            let firstPaymentAmount = 1; // Минимальная сумма для авторизации карты

            // Проверяем, есть ли активный Trial
            const hasActiveTrial = existingSubscription && 
                                  existingSubscription.subscriptionStatus === 'TRIAL' && 
                                  existingSubscription.trialEndsAt && 
                                  new Date(existingSubscription.trialEndsAt) > now;

            // Для подписок с пробным периодом (только месячные тарифы)
            if (['solo', 'studio', 'pro'].includes(planId)) {
                if (hasActiveTrial) {
                    // Если есть активный Trial, используем существующие даты
                    trialEndsAt = existingSubscription.trialEndsAt;
                    subscriptionEndsAt = new Date(existingSubscription.trialEndsAt.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 дней после Trial
                    firstPaymentAmount = 1; // Тестовая авторизация на 1 рубль
                    
                    console.log('[CLOUDPAYMENTS] Using existing Trial:', {
                        existingTrialEndsAt: existingSubscription.trialEndsAt,
                        remainingTrialDays: Math.ceil((existingSubscription.trialEndsAt - now) / (1000 * 60 * 60 * 24))
                    });
                } else {
                    // Если нет активного Trial, создаем новый только если не было раньше
                    const hadTrialBefore = existingSubscription && 
                                       existingSubscription.trialEndsAt && 
                                       existingSubscription.trialEndsAt <= now;
                    
                    if (!hadTrialBefore && !existingSubscription) {
                        // Первый Trial для нового пользователя
                        trialEndsAt = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 дней
                        subscriptionEndsAt = new Date(now.getTime() + 35 * 24 * 60 * 60 * 1000); // 35 дней (5 trial + 30 first month)
                        firstPaymentAmount = 1; // Тестовая авторизация на 1 рубль
                        
                        console.log('[CLOUDPAYMENTS] Creating new Trial for first time user');
                    } else {
                        // Trial уже был, платный тариф без Trial
                        trialEndsAt = null;
                        subscriptionEndsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 дней
                        firstPaymentAmount = subscriptionConfig.amount; // Полная стоимость
                        
                        console.log('[CLOUDPAYMENTS] User already had Trial, creating paid subscription');
                    }
                }
            } else if (['solo-yearly', 'studio-yearly', 'pro-yearly'].includes(subscriptionType)) {
                // Годовые тарифы - немедленная активация, полный доступ сразу после оплаты
                subscriptionEndsAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 365 дней
                firstPaymentAmount = subscriptionConfig.amount; // Полная стоимость годового тарифа
                
                console.log('[CLOUDPAYMENTS] Creating yearly subscription');
            }

            // Создаем подписку в CloudPayments с правильными параметрами
            // Чек для первого платежа
            const firstPaymentReceipt = {
                Items: [{
                    Label: subscriptionConfig.name,
                    Price: subscriptionConfig.amount * 100, // РЕАЛЬНАЯ ЦЕНА в копейках (99000 копеек)
                    Quantity: 1,
                    Amount: firstPaymentAmount * 100, // 1 рубль для месячных, полная стоимость для годовых
                    Vat: 20,
                    PaymentMethodType: 1,
                    PaymentObject: 1
                }],
                TaxationSystem: 2,
                Email: userEmail
            };

            // Чек для регулярных платежей
            const recurrentPaymentReceipt = {
                Items: [{
                    Label: subscriptionConfig.name,
                    Price: subscriptionConfig.amount * 100, // РЕАЛЬНАЯ ЦЕНА в копейках
                    Quantity: 1,
                    Amount: subscriptionConfig.amount * 100, // Полная стоимость для регулярных платежей
                    Vat: 20,
                    PaymentMethodType: 1,
                    PaymentObject: 1
                }],
                TaxationSystem: 2,
                Email: userEmail
            };

            // Создаем подписку в CloudPayments с правильным форматом согласно документации
            const cloudPaymentsData = {
                Token: cardToken,
                AccountId: userId,
                Email: userEmail,
                Description: `Подписка ${subscriptionConfig.name} для ${user.business?.name || userName}`,
                Amount: firstPaymentAmount, // 1 рубль для месячных, полная стоимость для годовых
                Currency: 'RUB',
                RequireConfirmation: false,
                StartDate: now, // Немедленная активация
                TrialPeriod: ['solo', 'studio', 'pro'].includes(planId) ? 5 : null, // 5 дней trial только для месячных тарифов
                CustomerReceipt: firstPaymentReceipt, //чек для первого платежа
                CloudPayments: {
                    recurrent: {
                        interval: 'Month',
                        period: 1, 
                        customerReceipt: recurrentPaymentReceipt //чек для регулярных платежей
                    }
                } //создание ежемесячной подписки
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

                // Обновляем или создаем данные подписки
                if (existingSubscription) {
                    // Обновляем существующую подписку
                    await prisma.subscription.update({
                        where: { businessId: user.businessId },
                        data: {
                            plan: planId.toUpperCase(),
                            maxUsers: subscriptionConfig.maxUsers,
                            usersLimit: subscriptionConfig.maxUsers,
                            subscriptionStatus: trialEndsAt ? 'TRIAL' : 'ACTIVE',
                            billingPeriod: subscriptionType === 'yearly' ? 'YEARLY' : 'MONTHLY',
                            trialEndsAt,
                            subscriptionEndsAt,
                            cloudpaymentsSubscriptionId: response.Model.Id.toString(),
                            nextPaymentDate: trialEndsAt || subscriptionEndsAt,
                            isActive: true,
                            cardAttachedAt: new Date(),
                            lastPaymentAt: new Date(),
                            autoRenewal: true
                        }
                    });
                } else {
                    // Создаем новую подписку
                    await prisma.subscription.create({
                        data: {
                            businessId: user.businessId,
                            plan: planId.toUpperCase(),
                            maxUsers: subscriptionConfig.maxUsers,
                            usersLimit: subscriptionConfig.maxUsers,
                            subscriptionStatus: trialEndsAt ? 'TRIAL' : 'ACTIVE',
                            billingPeriod: subscriptionType === 'yearly' ? 'YEARLY' : 'MONTHLY',
                            trialEndsAt,
                            subscriptionEndsAt,
                            cloudpaymentsSubscriptionId: response.Model.Id.toString(),
                            nextPaymentDate: trialEndsAt || subscriptionEndsAt,
                            isActive: true,
                            cardAttachedAt: new Date(),
                            lastPaymentAt: new Date(),
                            autoRenewal: true
                        }
                    });
                }

                // Обновляем данные пользователя
                await prisma.user.update({
                    where: { id: userId },
                    data: {
                        subscriptionStatus: trialEndsAt ? 'trial' : 'active',
                        subscriptionType: planId,
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

            if (!user) {
                throw new Error('User not found');
            }

            // Для TRIAL статуса или отсутствия cloudpaymentsSubscriptionId - отменяем только в базе
            if (!user.cloudPaymentsSubscriptionId || user.subscriptionStatus === 'TRIAL') {
                console.log('[CLOUDPAYMENTS] Cancelling trial/local subscription without CloudPayments API call');
                
                await prisma.user.update({
                    where: { id: userId },
                    data: {
                        subscriptionStatus: 'CANCELLED'
                    }
                });

                return {
                    success: true,
                    message: 'Подписка отменена. Доступ останется активным до ' + 
                           (user.subscriptionEndsAt ? user.subscriptionEndsAt.toLocaleDateString('ru-RU') : 'окончания периода')
                };
            }

            // Для активных подписок с cloudpaymentsSubscriptionId - отменяем в CloudPayments
            console.log('[CLOUDPAYMENTS] Cancelling CloudPayments subscription:', { cloudPaymentsSubscriptionId: user.cloudPaymentsSubscriptionId });
            
            const response = await this.makeRequest('/subscriptions/cancel', {
                Id: user.cloudPaymentsSubscriptionId
            });

            if (response.Success) {
                console.log('[CLOUDPAYMENTS] Subscription cancelled successfully');

                // Обновляем статус - не отключаем сразу, а помечаем как отмененную
                await prisma.user.update({
                    where: { id: userId },
                    data: {
                        subscriptionStatus: 'CANCELLED'
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
                // Неудачное продление - Grace Period 7 дней
                console.log('[CLOUDPAYMENTS] Subscription renewal failed - starting Grace Period');
                const gracePeriodEnd = new Date();
                gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7); // 7 дней Grace Period
                
                await prisma.user.update({
                    where: { id: accountId },
                    data: {
                        subscriptionStatus: 'grace_period',
                        gracePeriodEndsAt: gracePeriodEnd
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
            solo: {
                name: 'Solo',
                amount: 690, // 690 рублей
                description: '1 пользователь',
                maxUsers: 1
            },
            studio: {
                name: 'Studio', 
                amount: 990, // 990 рублей
                description: 'До 5 пользователей',
                maxUsers: 5
            },
            pro: {
                name: 'Pro',
                amount: 1490, // 1490 рублей  
                description: 'Более 5 пользователей',
                maxUsers: 15
            },
            // Годовые тарифы со скидкой 20%
            'solo-yearly': {
                name: 'Solo (Год)',
                amount: 6624, // 690 × 12 - 20% = 6624 рублей
                description: '1 пользователь (годовая подписка)',
                maxUsers: 1
            },
            'studio-yearly': {
                name: 'Studio (Год)',
                amount: 9504, // 990 × 12 - 20% = 9504 рублей
                description: 'До 5 пользователей (годовая подписка)',
                maxUsers: 5
            },
            'pro-yearly': {
                name: 'Pro (Год)',
                amount: 14304, // 1490 × 12 - 20% = 14304 рублей
                description: 'Более 5 пользователей (годовая подписка)',
                maxUsers: 15
            },
            // Для обратной совместимости
            monthly: {
                name: 'Studio',
                amount: 990, // 990 рублей
                description: 'До 5 пользователей',
                maxUsers: 5
            },
            yearly: {
                name: 'Studio (Год)',
                amount: 9504, // 990 × 12 - 20% = 9504 рублей
                description: 'До 5 пользователей (годовая подписка)',
                maxUsers: 5
            }
        };

        const config = configs[type];
        if (!config) {
            throw new Error(`Unknown subscription type: ${type}`);
        }

        return config;
    }

    /**
     * Получение данных для оплаты без создания подписки
     */
    async getPaymentData(subscriptionType, options = {}) {
        try {
            console.log('[CLOUDPAYMENTS] Getting payment data:', {
                subscriptionType,
                planId: options.planId,
                planName: options.planName,
                planAmount: options.planAmount,
                userEmail: options.userEmail
            });

            const config = this.getSubscriptionConfig(options.planId);
            
            // Определяем сумму и период триала
            const amount = options.planAmount || config.amount;
            const trialPeriod = config.trialPeriod || 5; // 5 дней по умолчанию
            const isTrial = trialPeriod > 0;

            // Формируем данные для CloudPayments виджета
            const cloudPaymentsData = {
                PublicId: this.publicId,
                Description: `Подписка ${options.planName} (${subscriptionType})`,
                Amount: amount, // 1 рубль для активации, реальная сумма в recurrent
                Currency: 'RUB',
                InvoiceId: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                AccountId: options.userEmail,
                Email: options.userEmail,
                RequireConfirmation: true,
                TrialPeriod: isTrial ? trialPeriod : 0,
                Recurring: {
                    Amount: config.amount, // Реальная сумма подписки
                    Period: subscriptionType === 'monthly' ? 'Month' : 'Year',
                    CustomerReceipt: {
                        Items: [{
                            Label: `Подписка ${options.planName}`,
                            Price: config.amount * 100, // в копейках
                            Quantity: 1,
                            Amount: config.amount * 100,
                            Vat: 20
                        }],
                        TaxationSystem: 2
                    }
                }
            };

            console.log('[CLOUDPAYMENTS] Payment data prepared:', {
                amount: cloudPaymentsData.Amount,
                trialPeriod: cloudPaymentsData.TrialPeriod,
                recurringAmount: cloudPaymentsData.Recurring.Amount
            });

            return cloudPaymentsData;
        } catch (error) {
            console.error('[CLOUDPAYMENTS] Error getting payment data:', error);
            throw error;
        }
    }
}

// Создаем singleton экземпляр
const cloudPaymentsService = new CloudPaymentsService();

module.exports = cloudPaymentsService;
