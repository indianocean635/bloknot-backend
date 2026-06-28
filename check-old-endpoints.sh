#!/bin/bash

echo "🔍 Проверка что старые эндпоинты не вызываются"
echo "============================================"

echo ""
echo "📋 1. Проверка версии сервера:"
cd /var/www/bloknot-backend
echo "Последние коммиты:"
git log --oneline -3

echo ""
echo "📋 2. Проверка что старых вызовов нет в коде:"
echo "Поиск 'payments/create' в public/:"
grep -r "payments/create" public/ || echo "✅ Старых вызовов не найдено!"

echo ""
echo "📋 3. Проверка что новый эндпоинт используется:"
echo "Поиск 'cloudpayments/subscription/create' в public/:"
grep -r "cloudpayments/subscription/create" public/ | wc -l
echo "найдено вызовов нового эндпоинта"

echo ""
echo "📋 4. Проверка последних логов на старые вызовы:"
echo "Поиск '[PAYMENT CREATED]' в логах:"
pm2 logs bloknot --lines 50 | grep -E "(PAYMENT CREATED|payments/create)" || echo "✅ Старых вызовов в логах нет!"

echo ""
echo "📋 5. Проверка что новый эндпоинт работает:"
echo "Проверка доступности нового эндпоинта:"
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/cloudpayments/subscription
echo " - HTTP статус код"

echo ""
echo "✅ Проверка завершена!"
echo "Если все проверки прошли успешно - старые эндпоинты не используются!"
