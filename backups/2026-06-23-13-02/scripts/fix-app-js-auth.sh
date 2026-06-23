#!/bin/bash
# Исправление функции api() в app.js для правильной аутентификации

echo "=== ИСПРАВЛЕНИЕ APP.JS АУТЕНТИФИКАЦИИ ==="

# 1. Создать резервную копию
cp /var/www/bloknot-backend/public/app.js /var/www/bloknot-backend/public/app.js.backup

# 2. Заменить строку с localStorage.getItem('bloknot_logged_in_email')
sed -i "s/localStorage.getItem('bloknot_logged_in_email')/localStorage.getItem('bloknot_logged_in_email') || localStorage.getItem('bloknot_user_email')/g" /var/www/bloknot-backend/public/app.js

# 3. Проверить что исправление применено
grep -n "bloknot_logged_in_email.*bloknot_user_email" /var/www/bloknot-backend/public/app.js

echo "✅ Исправление app.js применено"
echo "=== ОБНОВЛЕНИЕ КАША ДЛЯ БРАУЗЕРА ==="

# 4. Обновить cache-busting версию в dashboard.html
sed -i 's/styles.css?v=[0-9]*/styles.css?v=20260425/' /var/www/bloknot-backend/public/dashboard.html
sed -i 's/app.js?v=[0-9]*/app.js?v=20260425/' /var/www/bloknot-backend/public/dashboard.html

echo "✅ Cache-busting обновлен"
echo "=== ГОТОВО ДЛЯ ТЕСТИРОВАНИЯ ==="

echo "Теперь откройте dashboard.html в инкогнито и попробуйте войти в ЛК"
