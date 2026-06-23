#!/bin/bash
# Автоматическое исправление businessController.js

echo "=== АВТОМАТИЧЕСКОЕ ИСПРАВЛЕНИЕ BUSINESSCONTROLLER ==="

# 1. Восстановить из резервной копии
cp /var/www/bloknot-backend/controllers/businessController.js.backup-login /var/www/bloknot-backend/controllers/businessController.js

# 2. Правильно исправить owner.connect на ownerId с помощью sed
sed -i '/owner: {/,/}/{s/owner: {[^}]*connect: {[^}]*id: user.id[^}]*}[^}]*}/ownerId: user.id/g}' /var/www/bloknot-backend/controllers/businessController.js

# 3. Проверить синтаксис
echo "Проверяю синтаксис..."
node -c /var/www/bloknot-backend/controllers/businessController.js
if [ $? -eq 0 ]; then
    echo "✅ Синтаксис корректен"
else
    echo "❌ Ошибка синтаксиса, пробую другое исправление..."
    # Альтернативное исправление
    sed -i 's/owner: {[[:space:]]*connect: {[[:space:]]*id: user.id[[:space:]]*}[[:space:]]*}/ownerId: user.id/g' /var/www/bloknot-backend/controllers/businessController.js
    node -c /var/www/bloknot-backend/controllers/businessController.js
fi

# 4. Показать исправленные строки
echo "Исправленные строки (280-290):"
sed -n '280,290p' /var/www/bloknot-backend/controllers/businessController.js

# 5. Перезапустить сервер
echo "Перезапускаю сервер..."
pm2 restart bloknot-backend

# 6. Проверить статус
sleep 2
pm2 status
pm2 logs bloknot-backend --lines 5

echo "✅ Исправление завершено!"
