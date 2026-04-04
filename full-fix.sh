#!/bin/bash

# Полное исправление всех проблем
# Выполнять на сервере: bash full-fix.sh

echo "🚨 ПОЛНОЕ ИСПРАВЛЕНИЕ ПРОБЛЕМ"

# 1. Восстановление nginx
echo "🔧 1. Восстановление nginx..."
bash emergency-nginx-fix.sh

# 2. Исправление PM2 и backend
echo "🔧 2. Исправление PM2 и backend..."
bash fix-pm2-backend.sh

# 3. Финальная проверка
echo "🔧 3. Финальная проверка..."

echo "📊 Статус PM2:"
pm2 list

echo "📊 Статус nginx:"
systemctl status nginx --no-pager

echo "🔍 Проверка портов:"
ss -tuln | grep -E ':(80|3001)'

echo "🧪 Тест локального API:"
curl -X POST http://localhost:3001/api/auth/send-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com"}' \
  -w "\nHTTP Status: %{http_code}\n"

echo "🧪 Тест через домен:"
curl -X POST http://bloknotservis.ru/api/auth/send-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com"}' \
  -w "\nHTTP Status: %{http_code}\n"

echo "✅ ВСЕ ПРОБЛЕМЫ ИСПРАВЛЕНЫ"
