#!/bin/bash

echo "🔍 Проверка сервера перед тестированием CloudPayments"
echo "=================================================="

echo ""
echo "📋 1. Проверка версии сервера:"
cd /var/www/bloknot-backend
echo "Последние коммиты:"
git log --oneline -3

echo ""
echo "📋 2. Проверка статуса PM2:"
pm2 status

echo ""
echo "📋 3. Проверка логов (последние 10 строк):"
pm2 logs bloknot --lines 10

echo ""
echo "📋 4. Проверка здоровья сервера:"
curl -s http://localhost:3001/health | jq . || echo "Ошибка health check"

echo ""
echo "📋 5. Проверка CloudPayments эндпоинтов:"
echo "Проверка планов:"
curl -s http://localhost:3001/api/cloudpayments/plans | jq . || echo "Ошибка plans endpoint"

echo ""
echo "📋 6. Проверка переменных окружения:"
echo "CloudPayments конфигурация:"
grep -i cloudpayment .env | head -2

echo ""
echo "📋 7. Проверка доступности CloudPayments API:"
echo "Тестовый запрос к CloudPayments:"
curl -s -X POST https://api.cloudpayments.ru/test -H "Content-Type: application/json" -d "{}" | jq . || echo "Ошибка CloudPayments API"

echo ""
echo "✅ Проверка завершена!"
echo "Если все проверки прошли успешно - можно тестировать на пользователе"
