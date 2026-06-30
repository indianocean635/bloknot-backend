#!/bin/bash

# Бэкап базы данных Bloknot
# Создает бэкап PostgreSQL базы данных

set -e

# Конфигурация
BACKUP_DIR="/var/backups/bloknot/database"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="bloknot_database_${DATE}"
TIMESTAMP=$(date)

echo "=========================================="
echo "Начало бэкапа базы данных Bloknot"
echo "Время: $TIMESTAMP"
echo "=========================================="

# Создание директории для бэкапов
mkdir -p "$BACKUP_DIR"

echo "1. Бэкап базы данных PostgreSQL..."
sudo -u postgres pg_dump -d bloknot -F c -f "${BACKUP_DIR}/${BACKUP_NAME}.dump"

echo "2. Создание SQL дампа..."
sudo -u postgres pg_dump -d bloknot -f "${BACKUP_DIR}/${BACKUP_NAME}.sql"

echo "3. Создание метаданных бэкапа..."
cat > "${BACKUP_DIR}/${BACKUP_NAME}_info.txt" << EOF
========================================
Bloknot Database Backup
========================================
Дата: $TIMESTAMP
База данных: bloknot
Формат: PostgreSQL custom dump + SQL
Размер: $(du -h ${BACKUP_DIR}/${BACKUP_NAME}.dump | cut -f1)
========================================
Содержимое:
- ${BACKUP_NAME}.dump: PostgreSQL custom dump (для восстановления)
- ${BACKUP_NAME}.sql: SQL файл (для просмотра)
- ${BACKUP_NAME}_info.txt: информация о бэкапе
========================================
EOF

echo "4. Удаление старых бэкапов (оставляем последние 10)..."
cd "$BACKUP_DIR"
ls -t bloknot_database_*.dump | tail -n +11 | xargs -r rm
ls -t bloknot_database_*.sql | tail -n +11 | xargs -r rm
ls -t bloknot_database_*_info.txt | tail -n +11 | xargs -r rm

echo "=========================================="
echo "Бэкап базы данных завершен успешно!"
echo "Файлы:"
echo "  - ${BACKUP_DIR}/${BACKUP_NAME}.dump"
echo "  - ${BACKUP_DIR}/${BACKUP_NAME}.sql"
echo "  - ${BACKUP_DIR}/${BACKUP_NAME}_info.txt"
echo "Размер: $(du -h ${BACKUP_DIR}/${BACKUP_NAME}.dump | cut -f1)"
echo "=========================================="

# Вывод информации о бэкапах
echo "Последние бэкапы:"
ls -lh "$BACKUP_DIR" | head -10
