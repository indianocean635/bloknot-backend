#!/bin/bash
# Применение логов которые сохраняются при редиректе

echo "=== ПРИМЕНЕНИЕ PERSISTENT LOGS В APP.JS ==="

# 1. Создать резервную копию
cp /var/www/bloknot-backend/public/app.js /var/www/bloknot-backend/public/app.js.backup-persistent

# 2. Обновить cache-busting версию
sed -i 's/app.js?v=[0-9]*/app.js?v=20260425-persistent/' /var/www/bloknot-backend/public/dashboard.html

echo "✅ Persistent logs применены"
echo "=== ПРОВЕРКА ИСПРАВЛЕНИЯ ==="

# 3. Проверить что функции добавлены
grep -n "window.showDebugLogs" /var/www/bloknot-backend/public/app.js
grep -n "bloknot_debug_logs" /var/www/bloknot-backend/public/app.js

echo "=== ГОТОВО ДЛЯ ТЕСТИРОВАНИЯ ==="
echo "Теперь:"
echo "1. Откройте браузер в инкогнито"
echo "2. Войдите на сайт"
echo "3. Нажмите 'Мой кабинет'"
echo "4. После редиректа на главную откройте консоль (F12)"
echo "5. Выполните команду: showDebugLogs()"
echo "6. Посмотрите детальную информацию о том что произошло"
