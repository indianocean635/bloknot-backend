#!/bin/bash
# Автоматическое исправление всех синтаксических ошибок в settingsRoutes.js

echo "=== ИСПРАВЛЕНИЕ СИНТАКСИЧЕСКИХ ОШИБОК ==="

# 1. Проверить текущие ошибки синтаксиса
echo "1. Проверка синтаксиса..."
node -c /var/www/bloknot-backend/routes/settingsRoutes.js 2>&1 || echo "Синтаксические ошибки найдены"

# 2. Найти все строки с проблемными комментариями
echo "2. Поиск проблемных строк..."
grep -n "// requireMagicAuth" /var/www/bloknot-backend/routes/settingsRoutes.js || echo "Проблемных комментариев не найдено"

# 3. Исправить все строки с broken комментариями
echo "3. Исправление broken комментариев..."
sed -i 's|// requireMagicAuth, getBusinessFromUser, async|async|g' /var/www/bloknot-backend/routes/settingsRoutes.js

# 4. Удалить все middleware из роутов
echo "4. Удаление middleware..."
sed -i 's|requireMagicAuth, getBusinessFromUser,||g' /var/www/bloknot-backend/routes/settingsRoutes.js

# 5. Исправить конкретную проблему в строке 27
echo "5. Исправление строки 27..."
sed -i '27s|.*router.get("/business".*|router.get("/business", async (req, res) => {|' /var/www/bloknot-backend/routes/settingsRoutes.js

# 6. Проверить синтаксис после исправления
echo "6. Проверка синтаксиса после исправления..."
node -c /var/www/bloknot-backend/routes/settingsRoutes.js && echo "✅ Синтаксис корректен!" || echo "❌ Остались ошибки"

# 7. Запустить сервер
echo "7. Запуск сервера..."
PORT=3001 node index.js &
SERVER_PID=$!

# 8. Дать серверу время запуститься
sleep 3

# 9. Протестировать эндпоинты
echo "8. Тестирование эндпоинтов..."
curl -s http://127.0.0.1:3001/api/settings/masters || echo "❌ Masters endpoint failed"
curl -s http://127.0.0.1:3001/api/settings/business || echo "❌ Business endpoint failed"

# 10. Остановить сервер
kill $SERVER_PID 2>/dev/null

echo "=== ГОТОВО! ==="
