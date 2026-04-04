#!/bin/bash

# Полное восстановление сайта и настройка HTTPS
# Выполнять на сервере: bash full-recovery.sh

echo "🚨 ПОЛНОЕ ВОССТАНОВЛЕНИЕ САЙТА И HTTPS"

# 1. Восстановление nginx и сайта
echo "🔧 1. Восстановление nginx и сайта..."
bash emergency-recovery.sh

# 2. Проверить что сайт работает
echo "🧪 2. Проверка работы сайта:"
if curl -s -o /dev/null -w "%{http_code}" http://bloknotservis.ru/ | grep -q "200"; then
    echo "✅ Сайт работает по HTTP"
    
    # 3. Настройка HTTPS
    echo "🔐 3. Настройка HTTPS..."
    bash setup-https-after-recovery.sh
    
else
    echo "❌ Сайт не работает по HTTP, пропускаем HTTPS"
fi

# 4. Финальная проверка
echo "🧪 4. Финальная проверка:"
echo "HTTP:"
curl -I http://bloknotservis.ru/ 2>/dev/null | head -1

echo "HTTPS:"
curl -I https://bloknotservis.ru/ 2>/dev/null | head -1

echo "API:"
curl -X POST https://bloknotservis.ru/api/auth/send-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com"}' \
  -s | head -1

echo "✅ ВОССТАНОВЛЕНИЕ ЗАВЕРШЕНО"
