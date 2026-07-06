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

module.exports = router;
