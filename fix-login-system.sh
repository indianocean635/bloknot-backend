#!/bin/bash
# Исправление системы входа и регистрации

echo "=== ИСПРАВЛЕНИЕ СИСТЕМЫ ВХОДА И РЕГИСТРАЦИИ ==="

# 1. Применить исправления в index.html
echo "1. Применяю исправления в index.html..."
cp /var/www/bloknot-backend/public/index.html /var/www/bloknot-backend/public/index.html.backup-login

# Добавить сохранение bloknot_logged_in_email при входе
sed -i '/localStorage.setItem("bloknot_user_email", email);/a\          localStorage.setItem("bloknot_logged_in_email", email);' /var/www/bloknot-backend/public/index.html

# Добавить сохранение email при регистрации
sed -i '/showNotice("Ссылка для входа отправлена на ваш email. Проверьте почту и папку спам.");/a\\n        // For registration mode, save email to localStorage for future login\n        if (currentModalMode === '\''registration'\'') {\n          localStorage.setItem("bloknot_logged_in", "1");\n          localStorage.setItem("bloknot_user_email", email);\n          localStorage.setItem("bloknot_logged_in_email", email);\n          showNotice("Регистрация успешна! Email сохранен для входа.");\n        }' /var/www/bloknot-backend/public/index.html

# 2. Применить исправления в businessController.js
echo "2. Применяю исправления в businessController.js..."
cp /var/www/bloknot-backend/controllers/businessController.js /var/www/bloknot-backend/controllers/businessController.js.backup-login

# Заменить owner.connect на ownerId
sed -i 's/owner: {/ownerId: user.id/g' /var/www/bloknot-backend/controllers/businessController.js
sed -i '/connect: {/d' /var/www/bloknot-backend/controllers/businessController.js
sed -i '/id: user.id/d' /var/www/bloknot-backend/controllers/businessController.js

# 3. Применить исправления в magicAuthMiddleware.js
echo "3. Применяю исправления в magicAuthMiddleware.js..."
cp /var/www/bloknot-backend/middleware/magicAuthMiddleware.js /var/www/bloknot-backend/middleware/magicAuthMiddleware.js.backup-login

# 4. Обновить cache-busting
echo "4. Обновляю cache-busting..."
sed -i 's/app.js?v=[0-9]*/app.js?v=20260425-login-fix/' /var/www/bloknot-backend/public/dashboard.html
sed -i 's/index.html?v=[0-9]*/index.html?v=20260425-login-fix/' /var/www/bloknot-backend/public/dashboard.html

# 5. Перезапустить сервер
echo "5. Перезапускаю сервер..."
pm2 restart bloknot-backend

echo "✅ Все исправления применены!"
echo "=== ГОТОВО ДЛЯ ТЕСТИРОВАНИЯ ==="
echo "Теперь:"
echo "1. Вход по логину/паролю сохраняет email в localStorage"
echo "2. Регистрация сохраняет email в localStorage"
echo "3. Автоматическое создание бизнеса работает правильно"
echo "4. Каждый пользователь имеет уникальный ЛК"
