# PowerShell скрипт для настройки HTTPS на сервере bloknotservis.ru
# Запускать: .\setup-https-remote.ps1

$server = "root@bloknotservis.ru"
$commands = @'

# 1. Установка certbot
echo "📦 Установка certbot..."
apt update
apt install certbot python3-certbot-nginx -y

# 2. Поиск nginx конфига
echo "🔧 Поиск nginx конфига..."
if [ -f "/etc/nginx/sites-available/bloknotservis.ru" ]; then
    NGINX_CONF="/etc/nginx/sites-available/bloknotservis.ru"
elif [ -f "/etc/nginx/conf.d/bloknotservis.ru.conf" ]; then
    NGINX_CONF="/etc/nginx/conf.d/bloknotservis.ru.conf"
else
    echo "❌ Не найден nginx конфиг сайта"
    exit 1
fi

echo "📁 Найден конфиг: $NGINX_CONF"

# 3. Создание бэкапа
cp "$NGINX_CONF" "$NGINX_CONF.backup.$(date +%Y%m%d_%H%M%S)"
echo "💾 Создан бэкап конфига"

# 4. Показ текущего конфига
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
    
    # 9. Статус nginx
    echo "📊 Статус nginx:"
    systemctl status nginx --no-pager
    
    # 10. Финальный конфиг
    echo "📋 Финальный nginx конфиг:"
    cat "$NGINX_CONF"
    
    echo "✅ HTTPS настройка завершена!"
    
else
    echo "❌ Ошибка в конфиге nginx"
    exit 1
fi
'@

Write-Host "🔧 Подключаемся к серверу $server..."
Write-Host "📋 Выполняем команды для настройки HTTPS..."

try {
    $result = ssh $server $commands
    Write-Host "📤 Результат:"
    Write-Host $result
} catch {
    Write-Host "❌ Ошибка SSH подключения: $_"
    Write-Host "🔧 Выполните команды вручную на сервере:"
    Write-Host $commands
}

Write-Host "🌐 После выполнения проверьте: https://bloknotservis.ru"
