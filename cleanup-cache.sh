#!/bin/bash

# Скрипт автоматической очистки кэша
# Запускается ежедневно через cron

echo "[$(date)] Starting cache cleanup..."

# Очистка npm кэша
npm cache clean --force
rm -rf /root/.npm/_cacache/*

# Очистка apt кэша
apt-get clean
rm -rf /var/cache/apt/*.bin

# Очистка логов
find /var/log -type f -name "*.log" -size +50M -truncate -s 0
find /var/log -type f -name "*.gz" -delete

# Очистка временных файлов старше 7 дней
find /tmp -type f -mtime +7 -delete

# Очистка PM2 логов
pm2 flush

# Проверка места
echo "[$(date)] Disk usage after cleanup:"
df -h

echo "[$(date)] Cache cleanup completed"
