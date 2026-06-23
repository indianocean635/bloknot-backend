#!/bin/bash

# Скрипт для экстренного восстановления nginx
# Выполнять на сервере: bash emergency-nginx-fix.sh

echo "🚨 ЭКСТРЕННОЕ ВОССТАНОВЛЕНИЕ NGINX"

# 1. Проверить текущий конфиг
echo "📋 Текущий конфиг сайта:"
if [ -f "/etc/nginx/sites-enabled/bloknotservis.ru" ]; then
    echo "❌ Поврежденный конфиг:"
    cat /etc/nginx/sites-enabled/bloknotservis.ru
    echo ""
    echo "🗑️ Удаляем поврежденный конфиг..."
    rm /etc/nginx/sites-enabled/bloknotservis.ru
fi

# 2. Восстановить из sites-available
if [ -f "/etc/nginx/sites-available/bloknotservis.ru" ]; then
    echo "📁 Восстановление из sites-available..."
    cp /etc/nginx/sites-available/bloknotservis.ru /etc/nginx/sites-enabled/bloknotservis.ru
else
    echo "❌ Нет конфига в sites-available, создаем новый..."
    cat > /etc/nginx/sites-available/bloknotservis.ru << 'EOF'
server {
    listen 80;
    server_name bloknotservis.ru www.bloknotservis.ru;

    # =========================
    # 🔥 API (САМОЕ ВАЖНОЕ)
    # =========================
    location /api/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # =========================
    # 🌐 FRONT (СТАТИКА)
    # =========================
    location / {
        root /var/www/html;
        index index.html;

        try_files $uri $uri/ /index.html;
    }
}
EOF

    # Включить сайт
    ln -s /etc/nginx/sites-available/bloknotservis.ru /etc/nginx/sites-enabled/
fi

# 3. Проверить конфиг
echo "✅ Проверка конфига:"
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Конфиг валидный"
    
    # 4. Перезапустить nginx
    echo "🔄 Перезапуск nginx..."
    systemctl restart nginx
    systemctl status nginx --no-pager
    
    # 5. Проверить порты
    echo "🔍 Проверка портов:"
    ss -tuln | grep -E ':(80|443)'
    
else
    echo "❌ Конфиг все еще не валидный"
    exit 1
fi

echo "✅ NGINX ВОССТАНОВЛЕН"
