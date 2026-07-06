const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const {
    getCloudSubscriptionInfo,
    createSubscription,
    changeSubscriptionPlan,
    cancelSubscription,
    getSubscriptionPlans,
    updatePaymentMethod,
    getPaymentHistory
} = require('../controllers/cloudPaymentsController');
const cloudPaymentsService = require('../services/cloudPaymentsService');

const router = express.Router();

/**
 * Middleware для проверки аутентификации для всех маршрутов
 */
router.use(requireAuth);

/**
 * Получение информации о текущей подписке
 */
router.get('/subscription', (req, res, next) => {
    console.log('[CLOUDPAYMENTS ROUTE] Subscription endpoint called');
    console.log('[CLOUDPAYMENTS ROUTE] User:', req.user?.id, 'Business:', req.user?.businessId);
    next();
}, checkSubscriptionStatus, getCloudSubscriptionInfo);

/**
 * Получение доступных тарифов
 */
router.get('/plans', getSubscriptionPlans);

/**
 * Создание подписки
 */
router.post('/subscription/create', createSubscription);

/**
 * Смена тарифа для существующего клиента
 */
router.post('/subscription/change', changeSubscriptionPlan);

/**
 * Отмена подписки
 */
router.post('/subscription/cancel', cancelSubscription);

/**
 * Обновление способа оплаты
 */
router.post('/payment-method/update', updatePaymentMethod);

/**
 * Получение истории платежей
 */
router.get('/payment-history', getPaymentHistory);

/**
 * Webhook для CloudPayments
 * Этот маршрут не требует аутентификации
 */
router.post('/webhook', (req, res) => {
    cloudPaymentsService.handleWebhook(req, res);
});

/**
 * Тестовый endpoint для проверки работы сервиса
 */
router.get('/test', (req, res) => {
    console.log('[CLOUDPAYMENTS] Test endpoint called');
    res.json({
        success: true,
        message: 'CloudPayments service is working',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
