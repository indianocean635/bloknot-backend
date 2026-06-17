const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const { checkINN, generateInvoice, getPlans } = require('../controllers/invoiceController');

const router = express.Router();

// Middleware для аутентификации всех роутов
router.use(requireAuth);

/**
 * Проверка ИНН
 */
router.post('/check-inn', checkINN);

/**
 * Генерация счета
 */
router.post('/generate', generateInvoice);

/**
 * Получение тарифов
 */
router.get('/plans', getPlans);

module.exports = router;
