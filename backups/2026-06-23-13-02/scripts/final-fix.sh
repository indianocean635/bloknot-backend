#!/bin/bash

# Финальная диагностика и исправление
# Выполнять на сервере: bash final-fix.sh

echo "🚨 ФИНАЛЬНАЯ ДИАГНОСТИКА И ИСПРАВЛЕНИЕ"

# 1. Проверить работает ли локально
echo "🧪 1. Тест локального API:"
curl -X POST http://localhost:3001/api/auth/send-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com"}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -v

# 2. Проверить порт 3001
echo "🔍 2. Проверка порта 3001:"
ss -tuln | grep 3001
lsof -i :3001

# 3. Проверить nginx статус
echo "📊 3. Статус nginx:"
systemctl status nginx --no-pager

# 4. Проверить nginx конфиг
echo "📋 4. Проверка nginx конфига:"
nginx -t

# 5. Проверить порты nginx
echo "🔍 5. Проверка портов nginx:"
ss -tuln | grep -E ':(80|443)'

# 6. Проверить включен ли сайт
echo "📋 6. Проверка включенного сайта:"
ls -la /etc/nginx/sites-enabled/ | grep bloknot

# 7. Показать текущий конфиг
echo "📋 7. Текущий nginx конфиг:"
if [ -f "/etc/nginx/sites-enabled/bloknotservis.ru" ]; then
    cat /etc/nginx/sites-enabled/bloknotservis.ru
else
    echo "❌ Конфиг не найден"
fi

# 8. Тест через домен
echo "🧪 8. Тест через домен:"
curl -X POST http://bloknotservis.ru/api/auth/send-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com"}' \
  -w "\nHTTP Status: %{http_code}\n" \
  -v

# 9. Тест health endpoint
echo "🧪 9. Тест health endpoint:"
curl -I http://bloknotservis.ru/api/auth/send-link

# 10. Если nginx не работает, исправить
if ! systemctl is-active --quiet nginx; then
    echo "🔧 10. Nginx не работает, исправляем..."
    
    # Удалить поврежденный конфиг
    rm -f /etc/nginx/sites-enabled/bloknotservis.ru
    
    # Создать правильный конфиг
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
    ln -sf /etc/nginx/sites-available/bloknotservis.ru /etc/nginx/sites-enabled/
    
    # Проверить и перезапустить
    nginx -t && systemctl restart nginx
fi

# 11. Финальный тест
echo "🧪 11. Финальный тест:"
curl -X POST http://bloknotservis.ru/api/auth/send-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com"}' \
  -w "\nHTTP Status: %{http_code}\n"

echo "✅ ФИНАЛЬНАЯ ДИАГНОСТИКА ЗАВЕРШЕНА"
