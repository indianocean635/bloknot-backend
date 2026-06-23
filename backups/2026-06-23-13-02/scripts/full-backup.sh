#!/bin/bash

# Полный бэкап проекта Bloknot
# Включает: код, базу данных, настройки, конфигурации

set -e

# Конфигурация
BACKUP_DIR="/var/backups/bloknot"
PROJECT_DIR="/var/www/bloknot-backend"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="bloknot_full_backup_${DATE}"
TIMESTAMP=$(date)

echo "=========================================="
echo "Начало полного бэкапа Bloknot"
echo "Время: $TIMESTAMP"
echo "=========================================="

# Создание директории для бэкапов
mkdir -p "$BACKUP_DIR"

# Временная директория для бэкапа
TEMP_DIR="/tmp/${BACKUP_NAME}"
mkdir -p "$TEMP_DIR"

echo "1. Бэкап кода проекта..."
cd "$PROJECT_DIR"
tar -czf "${TEMP_DIR}/code.tar.gz" \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='uploads' \
    --exclude='logs' \
    --exclude='*.log' \
    .

echo "2. Бэкап базы данных PostgreSQL..."
sudo -u postgres pg_dump -d bloknot -F c -f "${TEMP_DIR}/database.dump"

echo "3. Бэкап настроек (.env)..."
cp "$PROJECT_DIR/.env" "${TEMP_DIR}/.env.backup"

echo "4. Бэкап nginx конфигурации..."
sudo cp /etc/nginx/sites-enabled/bloknotservis.ru "${TEMP_DIR}/nginx.conf"

echo "5. Бэкап PM2 конфигурации..."
pm2 save
cp "$HOME/.pm2/ecosystem.config.js" "${TEMP_DIR}/pm2.config.js" 2>/dev/null || true
cp "$PROJECT_DIR/ecosystem.config.js" "${TEMP_DIR}/ecosystem.config.js" 2>/dev/null || true

echo "6. Бэкап Prisma миграций..."
cp -r "$PROJECT_DIR/prisma" "${TEMP_DIR}/"

echo "7. Бэкап загруженных файлов..."
if [ -d "$PROJECT_DIR/uploads" ]; then
    tar -czf "${TEMP_DIR}/uploads.tar.gz" -C "$PROJECT_DIR" uploads
fi

echo "8. Создание метаданных бэкапа..."
cat > "${TEMP_DIR}/backup_info.txt" << EOF
========================================
Bloknot Full Backup
========================================
Дата: $TIMESTAMP
Версия: $(git -C "$PROJECT_DIR" rev-parse --short HEAD 2>/dev/null || echo "unknown")
Ветка: $(git -C "$PROJECT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
Коммит: $(git -C "$PROJECT_DIR" log -1 --oneline 2>/dev/null || echo "unknown")
========================================
Содержимое:
- code.tar.gz: код проекта (без node_modules)
- database.dump: PostgreSQL бэкап
- .env.backup: настройки окружения
- nginx.conf: конфигурация nginx
- pm2.config.js: конфигурация PM2
- ecosystem.config.js: конфигурация ecosystem
- prisma/: Prisma миграции
- uploads.tar.gz: загруженные файлы (если есть)
========================================
EOF

echo "9. Архивирование бэкапа..."
cd /tmp
tar -czf "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}"

echo "10. Очистка временных файлов..."
rm -rf "$TEMP_DIR"

echo "11. Удаление старых бэкапов (оставляем последние 7)..."
cd "$BACKUP_DIR"
ls -t bloknot_full_backup_*.tar.gz | tail -n +8 | xargs -r rm

echo "=========================================="
echo "Бэкап завершен успешно!"
echo "Файл: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
echo "Размер: $(du -h ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz | cut -f1)"
echo "=========================================="

# Вывод информации о бэкапе
echo "Список бэкапов:"
ls -lh "$BACKUP_DIR" | tail -5
