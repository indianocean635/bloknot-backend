const express = require('express');
const router = express.Router();
const adminStaffController = require('../controllers/adminStaffController');
const { requireAuth } = require('../middleware/authMiddleware');

// Все маршруты требуют аутентификации и прав супер админа

// Создание сотрудника
router.post('/', requireAuth, adminStaffController.createAdminStaff);

// Получение списка сотрудников
router.get('/', requireAuth, adminStaffController.getAdminStaffList);

// Удаление сотрудника
router.delete('/:id', requireAuth, adminStaffController.deleteAdminStaff);

// Получение результатов по менеджерам
router.get('/results', requireAuth, adminStaffController.getManagerResults);

// Поиск клиентов
router.get('/search-clients', requireAuth, adminStaffController.searchClients);

// Закрепление клиента за сотрудником
router.post('/assign-client', requireAuth, adminStaffController.assignClientToStaff);

module.exports = router;
