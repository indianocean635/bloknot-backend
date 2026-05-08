# Бэкап и восстановление проекта Bloknot

## 📋 Обзор

Этот документ описывает процесс создания полного бэкапа проекта Bloknot и процедуру восстановления.

## 🚀 Автоматический бэкап

### Запуск бэкапа

```bash
# На сервере
cd /var/www/bloknot-backend
sudo bash bloknot-backup.sh
```

### Что включает бэкап

1. **База данных PostgreSQL** - полная выгрузка базы данных bloknot
2. **Файлы проекта** - все файлы из `/var/www/bloknot-backend`
3. **Конфигурация PM2** - настройки процессов и ecosystem.config.js
4. **Конфигурация Nginx** - настройки веб-сервера и SSL
5. **Зависимости** - все npm пакеты из package.json

### Структура бэкапа

```
bloknot-backup-YYYYMMDD-HHMMSS.tar.gz
├── database-YYYYMMDD-HHMMSS.sql          # База данных
├── bloknot-backend-YYYYMMDD-HHMMSS.tar.gz # Файлы проекта
├── pm2-dump-YYYYMMDD-HHMMSS.txt         # PM2 конфигурация
├── ecosystem.config.js                  # PM2 ecosystem
└── nginx/                               # Nginx конфигурации
    ├── bloknotservis.ru
    └── bloknotservis.ru-ssl
```

## 🔄 Восстановление из бэкапа

### Шаг 1: Подготовка

```bash
# Перейдите в директорию бэкапов
cd /var/backups/bloknot

# Найдите нужный бэкап
ls -lh bloknot-backup-*.tar.gz
```

### Шаг 2: Распаковка бэкапа

```bash
# Распакуйте архив
tar -xzf bloknot-backup-YYYYMMDD-HHMMSS.tar.gz

# Перейдите в распакованную директорию
cd bloknot-backup-YYYYMMDD-HHMMSS
```

### Шаг 3: Восстановление базы данных

```bash
# Убедитесь, что PostgreSQL запущен
sudo systemctl status postgresql

# Создайте базу данных если не существует
sudo -u postgres createdb bloknot

# Восстановите базу данных
sudo -u postgres psql bloknot < database-YYYYMMDD-HHMMSS.sql
```

### Шаг 4: Восстановление файлов проекта

```bash
# Перейдите в /var/www
cd /var/www

# Удалите существующую директорию (создайте бэкап перед удалением!)
sudo mv bloknot-backend bloknot-backend.backup.$(date +%Y%m%d)

# Распакуйте файлы проекта
sudo tar -xzf /var/backups/bloknot/bloknot-backend-YYYYMMDD-HHMMSS.tar.gz

# Установите правильные права доступа
sudo chown -R www-data:www-data /var/www/bloknot-backend
sudo chmod -R 755 /var/www/bloknot-backend
```

### Шаг 5: Восстановление PM2 конфигурации

```bash
# Скопируйте ecosystem.config.js
sudo cp ecosystem.config.js /var/www/bloknot-backend/

# Восстановите PM2 процессы
cd /var/www/bloknot-backend
pm2 resurrect

# Сохраните конфигурацию
pm2 save

# Проверьте статус
pm2 status
```

### Шаг 6: Восстановление Nginx конфигурации

```bash
# Скопируйте конфигурации
sudo cp nginx/bloknotservis.ru /etc/nginx/sites-available/
sudo cp nginx/bloknotservis.ru-ssl /etc/nginx/sites-available/

# Создайте символические ссылки если нужно
sudo ln -sf /etc/nginx/sites-available/bloknotservis.ru /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/bloknotservis.ru-ssl /etc/nginx/sites-enabled/

# Проверьте конфигурацию Nginx
sudo nginx -t

# Перезагрузите Nginx
sudo systemctl reload nginx
```

### Шаг 7: Установка зависимостей

```bash
# Перейдите в директорию проекта
cd /var/www/bloknot-backend

# Установите зависимости
npm install

# Установите Prisma
npx prisma generate
```

### Шаг 8: Перезапуск сервисов

```bash
# Перезапустите PM2
pm2 restart bloknot

# Перезапустите Nginx
sudo systemctl restart nginx

# Проверьте статус сервисов
pm2 status
sudo systemctl status nginx
sudo systemctl status postgresql
```

## ✅ Проверка после восстановления

### Проверка сервисов

```bash
# Проверка PM2
pm2 status
pm2 logs bloknot --lines 50

# Проверка Nginx
sudo systemctl status nginx
curl -I https://bloknotservis.ru

# Проверка PostgreSQL
sudo -u postgres psql -c "SELECT version();"
```

### Проверка функциональности

1. **Главная страница** - откройте https://bloknotservis.ru
2. **Личный кабинет** - проверьте вход через magic link
3. **Админ-панель** - проверьте доступ к настройкам
4. **Загрузка изображений** - проверьте S3 загрузку
5. **База данных** - проверьте сохранение данных

## 📝 Ручное создание бэкапа

Если автоматический скрипт недоступен, можно создать бэкап вручную:

### Бэкап базы данных

```bash
pg_dump -U postgres -h localhost bloknot > backup-$(date +%Y%m%d).sql
```

### Бэкап файлов

```bash
tar -czf bloknot-backend-$(date +%Y%m%d).tar.gz /var/www/bloknot-backend
```

### Бэкап PM2

```bash
pm2 save
cp ~/.pm2/ecosystem.config.js backup/
```

### Бэкап Nginx

```bash
sudo cp /etc/nginx/sites-available/bloknotservis.ru backup/
sudo cp /etc/nginx/sites-available/bloknotservis.ru-ssl backup/
```

## 🔧 Настройка автоматического бэкапа

### Cron job для ежедневного бэкапа

```bash
# Откройте crontab
sudo crontab -e

# Добавьте строку для ежедневного бэкапа в 2:00 ночи
0 2 * * * /var/www/bloknot-backend/bloknot-backup.sh >> /var/log/bloknot-backup.log 2>&1
```

### Cron job для еженедельного бэкапа

```bash
# Добавьте строку для еженедельного бэкапа в воскресенье в 3:00 утра
0 3 * * 0 /var/www/bloknot-backend/bloknot-backup.sh >> /var/log/bloknot-backup.log 2>&1
```

## 🚨 Важные примечания

1. **Тестирование бэкапа** - регулярно проверяйте возможность восстановления из бэкапа
2. **Хранение бэкапов** - храните бэкапы в разных местах (локально + S3)
3. **Шифрование** - для чувствительных данных используйте шифрование бэкапов
4. **Документация** - ведите журнал всех бэкапов и восстановлений
5. **Мониторинг** - настройте уведомления о статусе бэкапов

## 📞 Поддержка

При возникновении проблем с бэкапом или восстановлением:

1. Проверьте логи: `/var/log/bloknot-backup.log`
2. Проверьте статус сервисов: `pm2 status`, `systemctl status`
3. Свяжитесь с администратором системы

## 📊 История бэкапов

| Дата | Номер деплоя | Размер | Статус |
|------|--------------|--------|--------|
| 2026-05-08 | 20260508-145000 | TBD | Создан |

---

**Последнее обновление:** 2026-05-08  
**Версия документа:** 1.0
