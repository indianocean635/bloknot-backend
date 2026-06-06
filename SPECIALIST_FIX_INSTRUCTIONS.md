# 🔧 Исправление ошибки создания специалистов

## 🚨 Проблема
```
Argument `business` is missing.
Invalid `prisma.master.create()` invocation
```

**Причина:** Поле `email` в модели `Master` было обязательным, но для SOLO плана email не нужен.

## ✅ Решение

### 1. **Обновлен код specialistsRoutes.js**
- Убрал `email: null` при создании специалиста
- Email добавляется только если он предоставлен

### 2. **Обновлена Prisma схема**
- Поле `email` теперь опциональное: `email String? @unique`

### 3. **Нужно применить миграцию на сервере**

## 📋 Инструкции для сервера

### **Шаг 1: Применить миграцию базы данных**

```bash
# Подключиться к серверу
ssh root@bloknot

# Перейти в папку проекта
cd /var/www/bloknot-backend

# Применить миграцию
psql -d bloknot -c "ALTER TABLE \"Master\" ALTER COLUMN \"email\" DROP NOT NULL;"

# Или через Prisma (если работает локальная база)
npx prisma migrate dev --name make_master_email_optional
```

### **Шаг 2: Обновить код на сервере**

```bash
# Получить последние изменения
git pull origin main

# Перезапустить приложение
pm2 restart bloknot
```

### **Шаг 3: Проверить результат**

```bash
# Проверить логи
pm2 logs bloknot

# Проверить схему базы данных
psql -d bloknot -c "\d Master"
```

## 🧪 Тестирование

1. **Зайдите в настройки**
2. **Выберите тариф "1 специалист"** 
3. **Добавьте специалиста** с только именем (без email)
4. **Должно работать без ошибок 500**

## 📊 Ожидаемый результат

**До исправления:**
```
POST /api/specialists 500 (Internal Server Error)
Argument `business` is missing
```

**После исправления:**
```
POST /api/specialists 201 (Created)
{
  "id": 1,
  "name": "Шала",
  "email": null,
  "businessId": "...",
  "active": true
}
```

## 🔍 SQL проверка

```sql
-- Проверить что поле email теперь nullable
SELECT column_name, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'Master' AND column_name = 'email';

-- Должно показать: is_nullable = YES
```

## ⚠️ Важно

- Миграция безопасна - не удаляет существующие данные
- Уникальность email сохраняется для непустых значений
- SOLO план может создавать специалистов без email
- STUDIO/PRO планы по-прежнему требуют email

## 🚀 После применения

Система будет работать корректно:
- ✅ Specialist создается с только именем (SOLO)
- ✅ Email необязателен для SOLO плана  
- ✅ Нет ошибок 500 Internal Server Error
- ✅ Фронтенд работает без сбоев

**Примените миграцию и перезапустите сервер!** 🎉
