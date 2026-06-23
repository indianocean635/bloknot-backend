#!/bin/bash

# ЭКСТРЕННОЕ ИСПРАВЛЕНИЕ КОНФИГА NGINX
# Выполнять на сервере: bash urgent-nginx-fix.sh

echo "🚨 ЭКСТРЕННОЕ ИСПРАВЛЕНИЕ NGINX КОНФИГА"

# 1. Показать поврежденный конфиг
echo "📋 Поврежденный конфиг:"
if [ -f "/etc/nginx/sites-enabled/bloknotservis.ru" ]; then
    echo "Содержимое /etc/nginx/sites-enabled/bloknotservis.ru:"
    cat -n /etc/nginx/sites-enabled/bloknotservis.ru
fi

# 2. Полностью остановить nginx
echo "🛑 Полная остановка nginx:"
systemctl stop nginx
killall nginx 2>/dev/null
sleep 2

# 3. Удалить все поврежденные конфиги
echo "🗑️ Удаление поврежденных конфигов:"
rm -f /etc/nginx/sites-enabled/bloknotservis.ru
rm -f /etc/nginx/sites-available/bloknotservis.ru

# 4. Создать правильный конфиг
echo "📝 Создание правильного конфига:"
cat > /etc/nginx/sites-available/bloknotservis.ru << 'EOF'
server {
    listen 80;
    server_name bloknotservis.ru www.bloknotservis.ru;

    # API прокси
    location /api/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Статика
    location / {
        root /var/www/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}
EOF

# 5. Включить сайт
echo "🔗 Включение сайта:"
ln -sf /etc/nginx/sites-available/bloknotservis.ru /etc/nginx/sites-enabled/

# 6. Проверить конфиг
echo "✅ Проверка конфига:"
nginx -t

# 7. Запустить nginx
echo "🚀 Запуск nginx:"
systemctl start nginx
sleep 2

# 8. Проверить статус
echo "📊 Статус nginx:"
systemctl status nginx --no-pager

# 9. Проверить порты
echo "🔍 Проверка портов:"
ss -tuln | grep -E ':(80|3001)'

# 10. Тест сайта
echo "🧪 Тест сайта:"
curl -I http://bloknotservis.ru/ 2>/dev/null | head -1

# 11. Тест API
echo "🧪 Тест API:"
curl -X POST http://bloknotservis.ru/api/auth/send-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com"}' \
  -s | head -1

echo "✅ ЭКСТРЕННОЕ ИСПРАВЛЕНИЕ ЗАВЕРШЕНО"
