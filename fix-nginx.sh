#!/bin/bash

# Скрипт для исправления nginx конфига
echo "🔧 Начинаем исправление nginx конфига..."

# 1. Находим конфиг сайта
NGINX_CONF=""
if [ -f "/etc/nginx/sites-available/bloknotservis.ru" ]; then
    NGINX_CONF="/etc/nginx/sites-available/bloknotservis.ru"
elif [ -f "/etc/nginx/conf.d/bloknotservis.ru.conf" ]; then
    NGINX_CONF="/etc/nginx/conf.d/bloknotservis.ru.conf"
elif [ -f "/etc/nginx/sites-enabled/bloknotservis.ru" ]; then
    NGINX_CONF="/etc/nginx/sites-enabled/bloknotservis.ru"
else
    echo "❌ Не найден конфиг сайта"
    exit 1
fi

echo "📁 Найден конфиг: $NGINX_CONF"

# 2. Создаем бэкап
cp "$NGINX_CONF" "$NGINX_CONF.backup.$(date +%Y%m%d_%H%M%S)"
echo "💾 Создан бэкап"

# 3. Ищем и заменяем блок location /api/
sed -i '/location \/api\/ {/,/}/ {
    s|proxy_pass http://localhost:3001/;|proxy_pass http://localhost:3001;|
    s|proxy_set_header Upgrade \$http_upgrade;|# proxy_set_header Upgrade $http_upgrade;|
    s|proxy_set_header Connection "upgrade";|# proxy_set_header Connection "upgrade";|
}' "$NGINX_CONF"

echo "✅ Исправлен proxy_pass"

# 4. Проверяем конфиг
nginx -t
if [ $? -eq 0 ]; then
    echo "✅ Конфиг валидный"
    
    # 5. Перезагружаем nginx
    systemctl reload nginx
    echo "✅ Nginx перезагружен"
    
    # 6. Тестируем
    echo "🔍 Тестируем API..."
    curl -X POST https://bloknotservis.ru/api/auth/send-link \
        -H "Content-Type: application/json" \
        -d '{"email":"test@test.com"}'
    
    echo ""
    echo "✅ Готово!"
else
    echo "❌ Ошибка в конфиге, откатываем изменения"
    cp "$NGINX_CONF.backup.$(date +%Y%m%d_%H%M%S)" "$NGINX_CONF"
    exit 1
fi
