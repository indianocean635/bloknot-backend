# 🚨 Инструкции по восстановлению сервера

## Проблема
После последних изменений сервер падает из-за ошибки с таблицей `VKLinkCode`, которой не существует в базе данных.

## Симптомы
- PM2 показывает постоянные перезапуски приложения
- Ошибка: `The table public.VKLinkCode does not exist`
- Нет доступа к админ панели
- Пропали данные бизнесов

## Решение

### 1. Подключитесь к серверу
```bash
ssh root@bloknot
cd /var/www/bloknot-backend
```

### 2. Остановите PM2
```bash
pm2 stop all
pm2 delete all
```

### 3. Примените миграцию базы данных
```bash
node apply-migration.js
```

### 4. Проверьте переменные окружения
```bash
ls -la .env*
```

Если `.env` отсутствует, создайте его из `.env.example`:
```bash
cp .env.example .env
# Отредактируйте .env с реальными данными
```

### 5. Установите зависимости (если нужно)
```bash
npm install
```

### 6. Сгенерируйте Prisma клиент
```bash
npx prisma generate
```

### 7. Запустите сервер
```bash
pm2 start index.js --name bloknot
```

### 8. Проверьте статус
```bash
pm2 status
pm2 logs bloknot --lines 20
```

## Если проблема осталась

### Проверка базы данных
```bash
npx prisma db pull
npx prisma migrate status
```

### Ручная миграция
Если автоматическая миграция не сработала:
```sql
-- Подключитесь к PostgreSQL
psql -h localhost -U bloknot_user -d bloknot

-- Добавьте поля вручную
ALTER TABLE "User" 
ADD COLUMN "subscriptionStatus" TEXT DEFAULT 'trial',
ADD COLUMN "subscriptionType" TEXT,
ADD COLUMN "trialEndsAt" TIMESTAMP(3),
ADD COLUMN "subscriptionEndsAt" TIMESTAMP(3),
ADD COLUMN "cloudPaymentsSubscriptionId" TEXT,
ADD COLUMN "cloudPaymentsCardToken" TEXT,
ADD COLUMN "nextPaymentDate" TIMESTAMP(3);

-- Обновите существующих пользователей
UPDATE "User" SET "subscriptionStatus" = 'trial' WHERE "subscriptionStatus" IS NULL;
```

### Проверка таблиц
```sql
-- Проверьте что таблицы существуют
\dt
-- Проверьте структуру таблицы User
\d "User"
```

## Важные замечания

1. **VK Polling Service временно отключен** - это не влияет на основную функциональность
2. **Существующие пользователи получат trial период на 5 дней**
3. **Все данные бизнесов должны остаться на месте**
4. **Авторизация должна работать после миграции**

## После восстановления

1. Проверьте работу сайта
2. Проверьте авторизацию
3. Проверьте данные бизнесов
4. Проверьте создание записей

## Если ничего не помогает

Создайте бэкап и откатитесь к предыдущему коммиту:
```bash
git log --oneline -10
git reset --hard <commit_hash_before_subscription>
pm2 restart bloknot
```

## Контакты для поддержки

Если проблема не решается, свяжитесь с разработчиком с предоставлением:
- Логов PM2 (`pm2 logs`)
- Статуса базы данных
- Версии коммита
