#!/bin/bash

# Скрипт для настройки HTTPS через Let's Encrypt
# Выполнять на сервере: bash setup-https.sh

set -e  # Выход при ошибке

echo "🔧 Начинаем настройку HTTPS для bloknotservis.ru"

# 1. Установка certbot
echo "📦 Установка certbot..."
apt update
apt install certbot python3-certbot-nginx -y

# 2. Проверка текущего nginx конфига
echo "📋 Проверка текущего nginx конфига..."
if [ -f "/etc/nginx/sites-available/bloknotservis.ru" ]; then
    NGINX_CONF="/etc/nginx/sites-available/bloknotservis.ru"
elif [ -f "/etc/nginx/conf.d/bloknotservis.ru.conf" ]; then
    NGINX_CONF="/etc/nginx/conf.d/bloknotservis.ru.conf"
else
    echo "❌ Не найден nginx конфиг сайта"
    exit 1
fi

echo "📁 Найден конфиг: $NGINX_CONF"

# 3. Создаем бэкап
cp "$NGINX_CONF" "$NGINX_CONF.backup.$(date +%Y%m%d_%H%M%S)"
echo "💾 Создан бэкап конфига"

# 4. Показываем текущий конфиг
echo "📋 Текущий nginx конфиг:"
cat "$NGINX_CONF"

# 5. Получение SSL сертификата
echo "🔐 Получение SSL сертификата..."
certbot --nginx -d bloknotservis.ru -d www.bloknotservis.ru

# 6. Проверка конфига
echo "✅ Проверка nginx конфига..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Конфиг валидный"
    
    # 7. Перезапуск nginx
    echo "🔄 Перезапуск nginx..."
    systemctl restart nginx
    
    # 8. Проверка порта 443
    echo "🔍 Проверка порта 443..."
    sleep 2
    ss -tuln | grep 443
    
    # 9. Проверка статуса nginx
    echo "📊 Статус nginx:"
    systemctl status nginx --no-pager
    
    # 10. Финальный конфиг
    echo "📋 Финальный nginx конфиг:"
    cat "$NGINX_CONF"
    
    echo "✅ HTTPS настройка завершена!"
    echo "🌐 Проверьте: https://bloknotservis.ru"
    
else
    echo "❌ Ошибка в конфиге nginx"
    echo "🔄 Откатываем изменения..."
    cp "$NGINX_CONF.backup.$(date +%Y%m%d_%H%M%S)" "$NGINX_CONF"
    exit 1
fi
