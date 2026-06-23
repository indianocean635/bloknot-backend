#!/bin/bash

# ЭКСТРЕННАЯ ДИАГНОСТИКА И ВОССТАНОВЛЕНИЕ
# Выполнять на сервере: bash emergency-recovery.sh

echo "🚨 ЭКСТРЕННОЕ ВОССТАНОВЛЕНИЕ САЙТА"

# 1. Проверить статус nginx
echo "📊 Статус nginx:"
systemctl status nginx --no-pager

# 2. Проверить конфиг nginx
echo "📋 Проверка конфига nginx:"
nginx -t

# 3. Проверить порты
echo "🔍 Проверка портов:"
ss -tuln | grep -E ':(80|443|3001)'

# 4. Проверить включенные сайты
echo "📋 Включенные сайты:"
ls -la /etc/nginx/sites-enabled/

# 5. Проверить доступные сайты
echo "📋 Доступные сайты:"
ls -la /etc/nginx/sites-available/

# 6. Если nginx не работает, восстановить
if ! systemctl is-active --quiet nginx; then
    echo "🔧 Восстановление nginx..."
    
    # Остановить nginx
    systemctl stop nginx
    
    # Удалить все конфиги bloknot
    rm -f /etc/nginx/sites-enabled/bloknotservis.ru
    rm -f /etc/nginx/sites-available/bloknotservis.ru
    
    # Создать простой HTTP конфиг
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

    # Включить сайт
    ln -sf /etc/nginx/sites-available/bloknotservis.ru /etc/nginx/sites-enabled/
    
    # Проверить и запустить
    nginx -t
    systemctl start nginx
    
    # Проверить статус
    systemctl status nginx --no-pager
fi

# 7. Проверить работу сайта
echo "🧪 Тест сайта HTTP:"
curl -I http://bloknotservis.ru/

# 8. Проверить работу API
echo "🧪 Тест API:"
curl -X POST http://bloknotservis.ru/api/auth/send-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com"}' \
  -w "\nHTTP Status: %{http_code}\n"

# 9. Проверить порты еще раз
echo "🔍 Финальная проверка портов:"
ss -tuln | grep -E ':(80|443|3001)'

echo "✅ ВОССТАНОВЛЕНИЕ ЗАВЕРШЕНО"
echo "🌐 Сайт должен работать по: http://bloknotservis.ru"
echo "🔧 Для HTTPS нужно выполнить: bash setup-https.sh"
