# Инструкция по восстановлению из бэкапа Bloknot

## Автоматическое восстановление

Используйте скрипт `restore-backup.sh` для автоматического восстановления:

```bash
# На сервере
cd /var/www/bloknot-backend
sudo ./restore-backup.sh /var/backups/bloknot/bloknot_full_backup_YYYYMMDD_HHMMSS.tar.gz
```

## Ручное восстановление

### 1. Подготовка

```bash
# Остановить приложение
pm2 stop bloknot

# Перейти в директорию проекта
cd /var/www/bloknot-backend
```

### 2. Распаковка бэкапа

```bash
# Создать временную директорию
mkdir -p /tmp/restore
cd /tmp/restore

# Распаковать бэкап
tar -xzf /var/backups/bloknot/bloknot_full_backup_YYYYMMDD_HHMMSS.tar.gz
cd bloknot_full_backup_*
```

### 3. Восстановление кода проекта

```bash
# Сохранить текущий код (на всякий случай)
cd /var/www/bloknot-backend
cp -r . ../bloknot-backend_backup_$(date +%Y%m%d)

# Распаковать код из бэкапа
tar -xzf /tmp/restore/bloknot_full_backup_*/code.tar.gz -C /var/www/bloknot-backend
```

### 4. Восстановление базы данных

```bash
# Восстановить PostgreSQL
sudo -u postgres pg_restore -d bloknot -F c /tmp/restore/bloknot_full_backup_*/database.dump

# Проверить восстановление
sudo -u postgres psql -d bloknot -c "\dt"
```

### 5. Восстановление настроек

```bash
# Восстановить .env
cp /tmp/restore/bloknot_full_backup_*/.env.backup /var/www/bloknot-backend/.env

# Восстановить nginx конфигурацию
sudo cp /tmp/restore/bloknot_full_backup_*/nginx.conf /etc/nginx/sites-enabled/bloknotservis.ru
sudo nginx -t
sudo systemctl reload nginx
```

### 6. Восстановление PM2 конфигурации

```bash
# Восстановить ecosystem.config.js
cp /tmp/restore/bloknot_full_backup_*/ecosystem.config.js /var/www/bloknot-backend/
```

### 7. Восстановление загруженных файлов

```bash
# Если есть uploads.tar.gz
if [ -f /tmp/restore/bloknot_full_backup_*/uploads.tar.gz ]; then
    tar -xzf /tmp/restore/bloknot_full_backup_*/uploads.tar.gz -C /var/www/bloknot-backend
fi
```

### 8. Установка зависимостей и запуск

```bash
cd /var/www/bloknot-backend

# Установить зависимости
npm ci

# Применить Prisma миграции
npx prisma migrate deploy
npx prisma generate

# Перезапустить приложение
pm2 restart bloknot

# Проверить статус
pm2 status
pm2 logs bloknot --lines 50
```

### 9. Проверка работоспособности

```bash
# Проверить здоровье приложения
curl http://localhost:3001/health

# Проверить nginx
curl https://bloknotservis.ru/

# Проверить API
curl https://bloknotservis.ru/api/auth/me
```

## Частичное восстановление

### Только база данных

```bash
sudo -u postgres pg_restore -d bloknot -F c /var/backups/bloknot/bloknot_full_backup_YYYYMMDD_HHMMSS.tar.gz
```

### Только код

```bash
cd /var/www/bloknot-backend
tar -xzf /var/backups/bloknot/bloknot_full_backup_YYYYMMDD_HHMMSS.tar.gz code.tar.gz
```

### Только настройки

```bash
cp /var/backups/bloknot/bloknot_full_backup_YYYYMMDD_HHMMSS/.env.backup /var/www/bloknot-backend/.env
```

## Решение проблем

### Ошибка при восстановлении базы данных

```bash
# Удалить существующую базу данных
sudo -u postgres psql -c "DROP DATABASE IF EXISTS bloknot;"

# Создать новую базу данных
sudo -u postgres psql -c "CREATE DATABASE bloknot;"

# Восстановить из бэкапа
sudo -u postgres pg_restore -d bloknot -F c /path/to/backup.dump
```

### Ошибка при восстановлении кода

```bash
# Удалить node_modules перед восстановлением
rm -rf /var/www/bloknot-backend/node_modules

# Переустановить зависимости
cd /var/www/bloknot-backend
npm ci
```

### Ошибка PM2

```bash
# Полностью перезапустить PM2
pm2 delete bloknot
pm2 start ecosystem.config.js
pm2 save
```

## Автоматические бэкапы

Для настройки автоматических бэкапов добавьте в cron:

```bash
# Ежедневный бэкап в 3 утра
0 3 * * * /var/www/bloknot-backend/full-backup.sh >> /var/log/bloknot-backup.log 2>&1

# Еженедельный бэкап в воскресенье в 4 утра
0 4 * * 0 /var/www/bloknot-backend/full-backup.sh >> /var/log/bloknot-backup.log 2>&1
```

## Мониторинг бэкапов

```bash
# Проверить размер бэкапов
du -h /var/backups/bloknot/*.tar.gz

# Проверить дату последнего бэкапа
ls -lt /var/backups/bloknot/*.tar.gz | head -1

# Проверить свободное место
df -h /var/backups
```

## Важные примечания

1. **Тестируйте восстановление** - регулярно проверяйте бэкапы на тестовом сервере
2. **Храните бэкапы в разных местах** - копируйте важные бэкапы на S3 или другой сервер
3. **Документируйте изменения** - записывайте все изменения в базе данных и коде
4. **Проверяйте целостность** - после восстановления проверяйте работоспособность всех функций
5. **Следите за местом** - удаляйте старые бэкапы автоматически

## Контакты при проблемах

Если возникнут проблемы при восстановлении:
1. Проверьте логи: `pm2 logs bloknot`
2. Проверьте nginx: `sudo tail -50 /var/log/nginx/error.log`
3. Проверьте PostgreSQL: `sudo tail -50 /var/log/postgresql/*.log`
