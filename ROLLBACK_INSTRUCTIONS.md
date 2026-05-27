# Инструкция по откату проекта Bloknot Backend

## 📌 Бэкап информация

- **Git тег:** `v1.0-backup-complete`
- **Git commit:** `91497cf`
- **Дата создания:** 27 мая 2026
- **Описание:** Полный бэкап проекта: PWA исправлен, авторизация работает 90 дней

## 🔄 Способы отката

### Способ 1: Откат через Git (Рекомендуемый)

#### Локальный откат
```bash
cd /var/www/bloknot-backend

# Посмотреть все теги
git tag

# Откат к бэкапу
git checkout v1.0-backup-complete

# Или откат к конкретному коммиту
git checkout 91497cf

# Если нужно вернуться на main
git checkout main
```

#### Откат на сервере с деплоем
```bash
cd /var/www/bloknot-backend

# Откат к бэкапу
git checkout v1.0-backup-complete

# Деплой в public директорию
cp -r public/* /var/www/html/
chown -R www-data:www-data /var/www/html/

# Перезапуск PM2
pm2 reload bloknot
pm2 reload telegram

# Проверка статуса
pm2 status
pm2 logs bloknot --lines 50
```

### Способ 2: Создание новой ветки от бэкапа

Если нужно сохранить текущую версию перед откатом:
```bash
cd /var/www/bloknot-backend

# Сохранить текущее состояние
git checkout -b broken-$(date +%Y%m%d)

# Создать ветку от бэкапа
git checkout -b restore-from-backup v1.0-backup-complete

# Деплой
cp -r public/* /var/www/html/
chown -R www-data:www-data /var/www/html/
pm2 reload bloknot
pm2 reload telegram
```

### Способ 3: Hard reset (Полный откат)

⚠️ **Внимание:** Удаляет все изменения после бэкапа

```bash
cd /var/www/bloknot-backend

# Сброс к бэкапу
git reset --hard v1.0-backup-complete

# Принудительный пуш (если нужно)
git push origin main --force

# Деплой
cp -r public/* /var/www/html/
chown -R www-data:www-data /var/www/html/
pm2 reload bloknot
pm2 reload telegram
```

## 🗄️ Откат базы данных

### Экспорт текущей базы данных (перед откатом)
```bash
# На сервере
pg_dump -U postgres bloknot_db > backup_before_rollback_$(date +%Y%m%d).sql

# Или через Docker
docker exec postgres_container pg_dump -U postgres bloknot_db > backup.sql
```

### Импорт бэкапа базы данных
```bash
# Если есть бэкап базы данных
psql -U postgres bloknot_db < backup_20260527.sql

# Или через Docker
docker exec -i postgres_container psql -U postgres bloknot_db < backup.sql
```

## 📁 Откат файлов (если есть файловый бэкап)

Если создавался архивный бэкап:
```bash
# Распаковка бэкапа
tar -xzf bloknot-backup-20260527.tar.gz

# Копирование файлов
cp -r bloknot-backup-20260527/public/* /var/www/html/
cp -r bloknot-backup-20260527/* /var/www/bloknot-backend/

# Права доступа
chown -R www-data:www-data /var/www/html/
chown -R root:root /var/www/bloknot-backend/

# Перезапуск
pm2 reload bloknot
pm2 reload telegram
```

## 🔍 Проверка после отката

### 1. Проверка Git статуса
```bash
cd /var/www/bloknot-backend
git status
git log --oneline -5
```

### 2. Проверка PM2
```bash
pm2 status
pm2 logs bloknot --lines 20
pm2 logs telegram --lines 20
```

### 3. Проверка сайта
```bash
# Проверка HTTP ответа
curl -I https://bloknotservis.ru

# Проверка API
curl https://bloknotservis.ru/api/auth/me
```

### 4. Проверка PWA
- Открыть сайт в Chrome DevTools
- Application → Service Workers
- Проверить статус и версию cache
- Удалить старый cache если нужно

### 5. Проверка базы данных
```bash
# Подключение к PostgreSQL
psql -U postgres bloknot_db

# Проверка таблиц
\dt

# Проверка пользователей
SELECT COUNT(*) FROM "User";
```

## 🚨 Экстренные ситуации

### Если сайт не работает после отката
```bash
# Проверка ошибок
pm2 logs bloknot --err

# Перезапуск
pm2 restart bloknot
pm2 restart telegram

# Если не помогает - полный рестарт
pm2 stop bloknot
pm2 stop telegram
pm2 start bloknot
pm2 start telegram
```

### Если база данных не работает
```bash
# Перезапуск PostgreSQL
sudo systemctl restart postgresql

# Или через Docker
docker restart postgres_container
```

### Если файлы не копируются
```bash
# Проверка прав
ls -la /var/www/html/
ls -la /var/www/bloknot-backend/

# Исправление прав
sudo chown -R www-data:www-data /var/www/html/
sudo chmod -R 755 /var/www/html/
```

## 📞 Контакты для поддержки

- **GitHub Issues:** https://github.com/indianocean635/bloknot-backend/issues
- **Документация:** PROJECT_STATE.md

## 📝 Чек-лист отката

- [ ] Создан бэкап текущей базы данных
- [ ] Создан бэкап текущих файлов
- [ ] Откат через Git выполнен
- [ ] Файлы скопированы в /var/www/html/
- [ ] Права доступа установлены
- [ ] PM2 процессы перезапущены
- [ ] Сайт доступен по HTTPS
- [ ] API отвечает корректно
- [ ] PWA работает
- [ ] Telegram бот активен
- [ ] База данных доступна

## 🔐 Безопасность

- Всегда создавайте бэкап перед откатом
- Не используйте `--force` пуш без необходимости
- Проверяйте права доступа после копирования файлов
- Тестируйте на staging среде если возможно
- Сохраняйте логи PM2 для анализа

## 📦 Автоматизация (опционально)

### Скрипт для автоматического отката
```bash
#!/bin/bash
# rollback.sh

BACKUP_TAG="v1.0-backup-complete"
BACKUP_DATE=$(date +%Y%m%d)

echo "Создание бэкапа..."
pg_dump -U postgres bloknot_db > /tmp/before_rollback_$BACKUP_DATE.sql
tar -czf /tmp/files_backup_$BACKUP_DATE.tar.gz /var/www/bloknot-backend/

echo "Откат через Git..."
cd /var/www/bloknot-backend
git checkout $BACKUP_TAG

echo "Деплой файлов..."
cp -r public/* /var/www/html/
chown -R www-data:www-data /var/www/html/

echo "Перезапуск PM2..."
pm2 reload bloknot
pm2 reload telegram

echo "Откат завершен!"
pm2 status
```

Использование:
```bash
chmod +x rollback.sh
sudo ./rollback.sh
```
