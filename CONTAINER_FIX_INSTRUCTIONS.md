# 🚨 Инструкции по исправлению бота в контейнере

## Проблема
- Старый бот в контейнере отправляет сообщения БЕЗ кнопок
- Новый бот с кнопками не может запуститься из-за конфликта 409
- Нужно заменить старый код на новый в контейнере

## 📋 План действий

### 1. Подключиться к серверу/контейнеру
```bash
# Если Docker:
docker exec -it <container_name> bash

# Если SSH:
ssh user@server
```

### 2. Остановить текущий бот
```bash
# Найти процесс бота
ps aux | grep node

# Остановить процессы
pkill -f "node.*index.js"
pkill -f "telegram"
```

### 3. Обновить код в контейнере
```bash
# Перейти в папку проекта
cd /app

# Получить последние изменения
git pull origin main

# Или скопировать файлы вручную:
# - services/telegramBotService.js
# - manage-bot.js
# - controllers/appointmentController.js
```

### 4. Заменить точку входа бота
Нужно заменить `index.js` на новый сервис:

```bash
# Создать backup старого файла
cp index.js index.js.backup

# Заменить точку входа
cp services/telegramBotService.js index.js
```

ИЛИ обновить `package.json`:
```json
{
  "scripts": {
    "start": "node services/telegramBotService.js"
  }
}
```

### 5. Перезапустить контейнер/сервис
```bash
# Если Docker:
docker restart <container_name>

# Если PM2:
pm2 restart bot

# Если просто процесс:
node services/telegramBotService.js
```

## 🔍 Проверка работы

### 1. Проверить логи
```bash
docker logs <container_name>
```
Должно быть:
```
🚀 Starting Telegram Bot...
📡 Mode: Polling
🔗 Backend URL: https://bloknotservis.ru
🚀 Health check server listening on port 8080
```

### 2. Проверить здоровье
```bash
curl http://localhost:8080/health
```
Должен вернуть: `{"status":"ok","timestamp":"..."}`

### 3. Тест с реальной записью
1. Создать новую запись на сайте
2. Нажать "Подключить Telegram"
3. Проверить что сообщение содержит кнопки:
   - ❌ Отменить запись
   - 🔄 Перенести запись

## 🚨 Если ошибка 409 остается

```bash
# Полностью очистить webhook
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/deleteWebhook"

# Подождать 30 секунд
sleep 30

# Запустить бота заново
node services/telegramBotService.js
```

## 📝 Файлы которые должны быть в контейнере

### ✅ Новые файлы:
- `services/telegramBotService.js` - основной бот с кнопками
- `manage-bot.js` - менеджер бота
- `TELEGRAM_BOT_SETUP.md` - документация

### ✅ Обновленные файлы:
- `controllers/appointmentController.js` - отправка подтверждений

## 🔧 Альтернативный вариант (если не работает)

### Вариант 1: Использовать manage-bot.js
```bash
# Запуск через менеджер
node manage-bot.js restart
```

### Вариант 2: Прямой запуск нового сервиса
```bash
# Остановить всё
pkill -f node

# Запустить новый сервис
node services/telegramBotService.js
```

## 📞 Поддержка

Если ничего не помогает:
1. Проверьте что все файлы скопированы в контейнер
2. Убедитесь что `TELEGRAM_BOT_TOKEN` правильный
3. Проверьте логи на наличие других ошибок

## ✅ Результат

После исправления:
- ✅ Сообщения будут содержать кнопки отмены/переноса
- ✅ Нет ошибки 409 Conflict
- ✅ Бот стабильно работает в контейнере
