#!/bin/bash

# Скрипт автоматического восстановления из бэкапа Bloknot
# Использование: sudo ./restore-backup.sh /path/to/backup.tar.gz

set -e

# Проверка аргументов
if [ -z "$1" ]; then
    echo "Ошибка: Укажите путь к файлу бэкапа"
    echo "Использование: sudo ./restore-backup.sh /path/to/bloknot_full_backup_YYYYMMDD_HHMMSS.tar.gz"
    exit 1
fi

BACKUP_FILE="$1"
PROJECT_DIR="/var/www/bloknot-backend"
TEMP_DIR="/tmp/restore_$(date +%Y%m%d_%H%M%S)"

echo "=========================================="
echo "Восстановление из бэкапа Bloknot"
echo "Файл: $BACKUP_FILE"
echo "=========================================="

# Проверка существования бэкапа
if [ ! -f "$BACKUP_FILE" ]; then
    echo "Ошибка: Файл бэкапа не найден: $BACKUP_FILE"
    exit 1
fi

# Создание временной директории
mkdir -p "$TEMP_DIR"

echo "1. Распаковка бэкапа..."
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"
BACKUP_CONTENT_DIR=$(find "$TEMP_DIR" -name "bloknot_full_backup_*" -type d | head -1)

if [ -z "$BACKUP_CONTENT_DIR" ]; then
    echo "Ошибка: Не удалось найти содержимое бэкапа"
    exit 1
fi

echo "2. Остановка приложения..."
pm2 stop bloknot || true

echo "3. Создание резервной копии текущего состояния..."
BACKUP_CURRENT_DIR="/var/backups/bloknot/before_restore_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_CURRENT_DIR"
cp -r "$PROJECT_DIR" "$BACKUP_CURRENT_DIR/"
echo "Текущее состояние сохранено в: $BACKUP_CURRENT_DIR"

echo "4. Восстановление кода проекта..."
tar -xzf "$BACKUP_CONTENT_DIR/code.tar.gz" -C "$PROJECT_DIR"

echo "5. Восстановление базы данных PostgreSQL..."
# Проверка соединения с PostgreSQL
sudo -u postgres psql -c "SELECT 1" > /dev/null 2>&1 || {
    echo "Ошибка: Нет соединения с PostgreSQL"
    exit 1
}

# Восстановление базы данных
sudo -u postgres pg_restore -d bloknot -F c "$BACKUP_CONTENT_DIR/database.dump" || {
    echo "Предупреждение: Возникли ошибки при восстановлении базы данных"
    echo "Проверьте целостность базы данных вручную"
}

echo "6. Восстановление настроек (.env)..."
cp "$BACKUP_CONTENT_DIR/.env.backup" "$PROJECT_DIR/.env"

echo "7. Восстановление nginx конфигурации..."
sudo cp "$BACKUP_CONTENT_DIR/nginx.conf" /etc/nginx/sites-enabled/bloknotservis.ru
sudo nginx -t || {
    echo "Ошибка: Конфигурация nginx некорректна"
    echo "Восстанавливаем предыдущую конфигурацию..."
    sudo cp "$BACKUP_CURRENT_DIR/bloknot-backend/nginx.conf" /etc/nginx/sites-enabled/bloknotservis.ru
}
sudo systemctl reload nginx

echo "8. Восстановление PM2 конфигурации..."
if [ -f "$BACKUP_CONTENT_DIR/ecosystem.config.js" ]; then
    cp "$BACKUP_CONTENT_DIR/ecosystem.config.js" "$PROJECT_DIR/"
fi

echo "9. Восстановление загруженных файлов..."
if [ -f "$BACKUP_CONTENT_DIR/uploads.tar.gz" ]; then
    tar -xzf "$BACKUP_CONTENT_DIR/uploads.tar.gz" -C "$PROJECT_DIR"
fi

echo "10. Установка зависимостей..."
cd "$PROJECT_DIR"
npm ci

echo "11. Применение Prisma миграций..."
npx prisma migrate deploy
npx prisma generate

echo "12. Перезапуск приложения..."
pm2 restart bloknot || pm2 start ecosystem.config.js
pm2 save

echo "13. Очистка временных файлов..."
rm -rf "$TEMP_DIR"

echo "=========================================="
echo "Восстановление завершено успешно!"
echo "Резервная копия сохранена в: $BACKUP_CURRENT_DIR"
echo "=========================================="

echo "14. Проверка работоспособности..."
sleep 5
pm2 status
pm2 logs bloknot --lines 20 --nostream

echo "=========================================="
echo "Проверьте работоспособность приложения:"
echo "  - curl http://localhost:3001/health"
echo "  - curl https://bloknotservis.ru/"
echo "=========================================="
