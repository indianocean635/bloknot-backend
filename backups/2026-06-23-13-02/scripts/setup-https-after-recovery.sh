#!/bin/bash

# Настройка HTTPS после восстановления
# Выполнять на сервере: bash setup-https-after-recovery.sh

echo "🔐 НАСТРОЙКА HTTPS ПОСЛЕ ВОССТАНОВЛЕНИЯ"

# 1. Проверить что сайт работает по HTTP
echo "🧪 Проверка HTTP:"
curl -I http://bloknotservis.ru/

# 2. Установить certbot
echo "📦 Установка certbot..."
apt update
apt install certbot python3-certbot-nginx -y

# 3. Получить SSL сертификат
echo "🔐 Получение SSL сертификата..."
certbot --nginx -d bloknotservis.ru -d www.bloknotservis.ru

# 4. Проверить конфиг
echo "✅ Проверка конфига:"
nginx -t

# 5. Перезапустить nginx
echo "🔄 Перезапуск nginx:"
systemctl restart nginx

# 6. Проверить порты
echo "🔍 Проверка портов:"
ss -tuln | grep -E ':(80|443)'

# 7. Тест HTTPS
echo "🧪 Тест HTTPS:"
curl -I https://bloknotservis.ru/

# 8. Тест API через HTTPS
echo "🧪 Тест API через HTTPS:"
curl -X POST https://bloknotservis.ru/api/auth/send-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com"}' \
  -w "\nHTTP Status: %{http_code}\n"

echo "✅ HTTPS НАСТРОЕН"
echo "🌐 Сайт работает по: https://bloknotservis.ru"
