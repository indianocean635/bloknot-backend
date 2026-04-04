#!/bin/bash

# Скрипт для диагностики проблемы с magic link
# Выполнять на сервере: bash diagnose-magic-link.sh

echo "🔍 ДИАГНОСТИКА MAGIC LINK ПРОБЛЕМЫ"
echo "=================================="

# 1. Проверка статуса PM2
echo "📊 Статус PM2:"
pm2 list

# 2. Проверка порта 3001
echo "🔍 Проверка порта 3001:"
ss -tuln | grep 3001

# 3. Тестирование локального API
echo "🧪 Тестирование локального API:"
curl -X POST http://localhost:3001/api/auth/send-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com"}' \
  -w "\nHTTP Status: %{http_code}\n"

# 4. Проверка nginx
echo "🌐 Проверка nginx:"
systemctl status nginx --no-pager

# 5. Проверка конфига nginx
echo "📋 Проверка конфига nginx:"
nginx -t

# 6. Проверка портов nginx
echo "🔍 Проверка портов nginx:"
ss -tuln | grep -E ':(80|443)'

# 7. Тестирование через домен (HTTP)
echo "🧪 Тестирование через домен (HTTP):"
curl -X POST http://bloknotservis.ru/api/auth/send-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com"}' \
  -w "\nHTTP Status: %{http_code}\n"

# 8. Тестирование через домен (HTTPS)
echo "🧪 Тестирование через домен (HTTPS):"
curl -X POST https://bloknotservis.ru/api/auth/send-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com"}' \
  -w "\nHTTP Status: %{http_code}\n"

# 9. Проверка логов в реальном времени
echo "📋 Последние 5 строк логов приложения:"
pm2 logs bloknot --lines 5

echo "✅ ДИАГНОСТИКА ЗАВЕРШЕНА"
