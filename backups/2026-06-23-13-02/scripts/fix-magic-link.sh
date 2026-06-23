# ИСПРАВЛЕНИЕ ПРОБЛЕМ С MAGIC LINK
# Выполнять на сервере

echo "🔧 ИСПРАВЛЕНИЕ ПРОБЛЕМ..."

# 1. Обновить код с последними изменениями:
cd /var/www/bloknot-backend
git pull origin main

# 2. Перезапустить PM2:
pm2 restart bloknot

# 3. Проверить статус PM2:
pm2 list

# 4. Проверить работает ли локально:
echo "🧪 Тест локального API:"
curl -X POST http://localhost:3001/api/auth/send-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com"}'

# 5. Если nginx не настроен правильно:
if [ ! -f "/etc/nginx/sites-enabled/bloknotservis.ru" ]; then
    echo "🔧 Включение сайта в nginx..."
    ln -s /etc/nginx/sites-available/bloknotservis.ru /etc/nginx/sites-enabled/
fi

# 6. Проверить и перезагрузить nginx:
nginx -t
systemctl reload nginx

# 7. Проверить порты:
echo "🔍 Проверка портов:"
ss -tuln | grep -E ':(80|443|3001)'

# 8. Тестировать через домен:
echo "🧪 Тест через домен:"
curl -X POST http://bloknotservis.ru/api/auth/send-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com"}'

echo "✅ ИСПРАВЛЕНИЯ ЗАВЕРШЕНЫ"
