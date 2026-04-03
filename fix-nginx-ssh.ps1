# PowerShell скрипт для исправления nginx конфига через SSH
# Запускать: .\fix-nginx-ssh.ps1

$server = "root@bloknotservis.ru"
$commands = @"

# 1. Находим конфиг сайта
echo '🔧 Поиск nginx конфига...'
if [ -f '/etc/nginx/sites-available/bloknotservis.ru' ]; then
    NGINX_CONF='/etc/nginx/sites-available/bloknotservis.ru'
elif [ -f '/etc/nginx/conf.d/bloknotservis.ru.conf' ]; then
    NGINX_CONF='/etc/nginx/conf.d/bloknotservis.ru.conf'
elif [ -f '/etc/nginx/sites-enabled/bloknotservis.ru' ]; then
    NGINX_CONF='/etc/nginx/sites-enabled/bloknotservis.ru'
else
    echo '❌ Не найден конфиг сайта'
    exit 1
fi

echo '📁 Найден конфиг: '$NGINX_CONF

# 2. Создаем бэкап
cp '$NGINX_CONF' '$NGINX_CONF.backup.'$(date +%Y%m%d_%H%M%S)'
echo '💾 Создан бэкап'

# 3. Показываем текущий блок location /api/
echo '📋 Текущий блок location /api/:'
grep -A 10 'location /api/' '$NGINX_CONF'

# 4. Исправляем proxy_pass (убираем слэш)
sed -i 's|proxy_pass http://localhost:3001/;|proxy_pass http://localhost:3001;|g' '$NGINX_CONF'

# 5. Удаляем лишние headers
sed -i '/proxy_set_header Upgrade \$http_upgrade;/s/^/# /' '$NGINX_CONF'
sed -i '/proxy_set_header Connection \"upgrade\";/s/^/# /' '$NGINX_CONF'

echo '✅ Исправлен proxy_pass'

# 6. Показываем исправленный блок
echo '📋 Исправленный блок location /api/:'
grep -A 10 'location /api/' '$NGINX_CONF'

# 7. Проверяем конфиг
nginx -t
if [ $? -eq 0 ]; then
    echo '✅ Конфиг валидный'
    
    # 8. Перезагружаем nginx
    systemctl reload nginx
    echo '✅ Nginx перезагружен'
    
    # 9. Тестируем API
    echo '🔍 Тестируем API...'
    curl -X POST https://bloknotservis.ru/api/auth/send-link \
        -H 'Content-Type: application/json' \
        -d '{\"email\":\"test@test.com\"}'
    
    echo ''
    echo '✅ Готово!'
else
    echo '❌ Ошибка в конфиге'
    exit 1
fi
"@

Write-Host "🔧 Подключаемся к серверу $server..."
Write-Host "📋 Команды для выполнения:"
Write-Host $commands

# Попытка выполнить команды через SSH
try {
    $result = ssh $server $commands
    Write-Host "📤 Результат:"
    Write-Host $result
} catch {
    Write-Host "❌ Ошибка SSH подключения: $_"
    Write-Host "🔧 Выполните команды вручную на сервере:"
    Write-Host $commands
}
