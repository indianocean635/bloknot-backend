#!/bin/bash
# Применение детальных логов в app.js вручную

echo "=== ПРИМЕНЕНИЕ ДЕТАЛЬНЫХ ЛОГОВ В APP.JS ==="

# 1. Создать резервную копию
cp /var/www/bloknot-backend/public/app.js /var/www/bloknot-backend/public/app.js.backup-debug

# 2. Добавить детальные логи после строки "async function api(path, opts) {"
sed -i '/async function api(path, opts) {/a\
    console.log(`[API] START: Making request to ${path}`);\
    console.log(`[API] localStorage keys:`, {\
      bloknot_logged_in_email: localStorage.getItem('\''bloknot_logged_in_email'\''),\
      bloknot_user_email: localStorage.getItem('\''bloknot_user_email'\''),\
      bloknot_logged_in: localStorage.getItem('\''bloknot_logged_in'\'')\
    });' /var/www/bloknot-backend/public/app.js

# 3. Добавить лог после поиска userEmail
sed -i '/let userEmail = localStorage.getItem.*bloknot_user_email/a\
    console.log(`[API] Found userEmail: ${userEmail}`);' /var/www/bloknot-backend/public/app.js

# 4. Добавить логи в проверке cookie
sed -i '/if (!userEmail) {/a\
      console.log(`[API] No userEmail in localStorage, checking cookies...`);\
      const cookies = document.cookie.split(';'\'');\
      console.log(`[API] All cookies:`, document.cookie);' /var/www/bloknot-backend/public/app.js

# 5. Добавить финальные логи
sed -i '/break;/a\
    }\
    \
    console.log(`[API] Final userEmail: ${userEmail}`);\
    console.log(`[API] Making request to ${path} with email: ${userEmail}`);' /var/www/bloknot-backend/public/app.js

# 6. Добавить лог перед редиректом
sed -i '/window.location.href = '\''\/'\'';/i\
      console.log(`[API] NO userEmail found, redirecting to login`);' /var/www/bloknot-backend/public/app.js

# 7. Обновить cache-busting
sed -i 's/app.js?v=[0-9]*/app.js?v=20260425-debug/' /var/www/bloknot-backend/public/dashboard.html

echo "✅ Детальные логи добавлены"
echo "=== ПРОВЕРКА ИСПРАВЛЕНИЯ ==="

# 8. Проверить что логи добавлены
grep -n "localStorage keys:" /var/www/bloknot-backend/public/app.js

echo "=== ГОТОВО ДЛЯ ТЕСТИРОВАНИЯ ==="
echo "Теперь откройте dashboard.html в инкогнито с открытой консолью (F12)"
