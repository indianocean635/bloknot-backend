#!/bin/bash

# Скрипт для диагностики и исправления PM2 проблем
# Выполнять на сервере: bash fix-pm2-backend.sh

echo "🔧 ДИАГНОСТИКА PM2 И BACKEND"

# 1. Проверить статус PM2
echo "📊 Статус PM2:"
pm2 list

# 2. Проверить логи
echo "📋 Логи приложения:"
pm2 logs bloknot --lines 10

# 3. Проверить работает ли процесс на порту 3001
echo "🔍 Проверка порта 3001:"
ss -tuln | grep 3001

# 4. Проверить какой процесс слушает порт 3001
echo "🔍 Какой процесс слушает порт 3001:"
lsof -i :3001

# 5. Проверить файл index.js
echo "📋 Проверка файла index.js:"
if [ -f "/var/www/bloknot-backend/index.js" ]; then
    echo "✅ Файл index.js существует"
    head -10 /var/www/bloknot-backend/index.js
else
    echo "❌ Файл index.js НЕ существует"
fi

# 6. Проверить package.json
echo "📋 Проверка package.json:"
if [ -f "/var/www/bloknot-backend/package.json" ]; then
    echo "✅ Файл package.json существует"
    grep -A5 '"scripts"' /var/www/bloknot-backend/package.json
else
    echo "❌ Файл package.json НЕ существует"
fi

# 7. Проверить ecosystem.config.js
echo "📋 Проверка ecosystem.config.js:"
if [ -f "/var/www/bloknot-backend/ecosystem.config.js" ]; then
    echo "✅ Файл ecosystem.config.js существует"
    cat /var/www/bloknot-backend/ecosystem.config.js
else
    echo "❌ Файл ecosystem.config.js НЕ существует"
fi

# 8. Попробовать запустить напрямую
echo "🧪 Попробовать запустить напрямую:"
cd /var/www/bloknot-backend
node index.js &
sleep 2
ps aux | grep node
kill %1 2>/dev/null

# 9. Перезапустить PM2 с чистого листа
echo "🔄 Перезапуск PM2 с чистого листа:"
pm2 delete bloknot 2>/dev/null
pm2 start index.js --name bloknot
pm2 list

# 10. Проверить порт еще раз
echo "🔍 Проверка порта 3001 после перезапуска:"
sleep 3
ss -tuln | grep 3001

# 11. Тестировать локально
echo "🧪 Тест локального API:"
curl -X POST http://localhost:3001/api/auth/send-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com"}' \
  -w "\nHTTP Status: %{http_code}\n"

echo "✅ ДИАГНОСТИКА ЗАВЕРШЕНА"
