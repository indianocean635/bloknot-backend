# Миграция данных для Multi-Tenant архитектуры

## Что изменилось

Проект был переделан в multi-tenant SaaS с полной изоляцией данных по бизнесам.

### Основные изменения в схеме:

1. **User** - добавлено поле `businessId` для связи с бизнесом
2. **Business** - новая модель для хранения информации о бизнесе
3. **StaffInvite** - приглашения сотрудников
4. **Staff** - информация о сотрудниках
5. **Все tenant-модели** (Service, Category, Master, WorkPhoto, Branch, Appointment) - добавлено поле `businessId` с каскадным удалением

## Стратегия миграции существующих данных

### Проблема
Сейчас все данные общие для всех пользователей. После миграции каждый пользователь должен видеть только данные своего бизнеса.

### Решение

#### 1. Создание бизнесов для существующих пользователей
```sql
-- Для каждого существующего пользователя создаем бизнес
INSERT INTO "Business" (id, name, slug, "ownerId", "createdAt")
SELECT 
  gen_random_uuid(),
  COALESCE('Business ' || email, 'Default Business'),
  gen_random_uuid(),
  id,
  "createdAt"
FROM "User"
WHERE "businessId" IS NULL;

-- Обновляем пользователей, устанавливая businessId
UPDATE "User" u
SET "businessId" = b.id
FROM "Business" b
WHERE b."ownerId" = u.id AND u."businessId" IS NULL;
```

#### 2. Распределение существующих данных
```sql
-- Services
UPDATE "Service" s
SET "businessId" = u."businessId"
FROM "User" u
WHERE u.id = (
  SELECT "ownerId" 
  FROM "Business" 
  LIMIT 1
);

-- Categories
UPDATE "Category" c
SET "businessId" = u."businessId"
FROM "User" u
WHERE u.id = (
  SELECT "ownerId" 
  FROM "Business" 
  LIMIT 1
);

-- Masters
UPDATE "Master" m
SET "businessId" = u."businessId"
FROM "User" u
WHERE u.id = (
  SELECT "ownerId" 
  FROM "Business" 
  LIMIT 1
);

-- WorkPhotos
UPDATE "WorkPhoto" w
SET "businessId" = u."businessId"
FROM "User" u
WHERE u.id = (
  SELECT "ownerId" 
  FROM "Business" 
  LIMIT 1
);

-- Branches
UPDATE "Branch" b
SET "businessId" = u."businessId"
FROM "User" u
WHERE u.id = (
  SELECT "ownerId" 
  FROM "Business" 
  LIMIT 1
);

-- Appointments
UPDATE "Appointment" a
SET "businessId" = u."businessId"
FROM "User" u
WHERE u.id = (
  SELECT "ownerId" 
  FROM "Business" 
  LIMIT 1
);
```

## Пошаговая инструкция для продакшена

### 1. Бэкап базы данных
```bash
pg_dump bloknot_prod > backup_before_migration.sql
```

### 2. Применение миграций Prisma
```bash
npx prisma migrate deploy
npx prisma generate
```

### 3. Выполнение SQL-миграции данных
Создайте файл `migrate_existing_data.sql` с SQL-кодом выше и выполните:
```bash
psql -d bloknot_prod -f migrate_existing_data.sql
```

### 4. Проверка данных
```sql
-- Проверить что у всех пользователей есть businessId
SELECT COUNT(*) FROM "User" WHERE "businessId" IS NULL;

-- Проверить что у всех tenant-записей есть businessId
SELECT 'services', COUNT(*) FROM "Service" WHERE "businessId" IS NULL
UNION ALL
SELECT 'categories', COUNT(*) FROM "Category" WHERE "businessId" IS NULL
UNION ALL
SELECT 'masters', COUNT(*) FROM "Master" WHERE "businessId" IS NULL
UNION ALL
SELECT 'work_photos', COUNT(*) FROM "WorkPhoto" WHERE "businessId" IS NULL
UNION ALL
SELECT 'branches', COUNT(*) FROM "Branch" WHERE "businessId" IS NULL
UNION ALL
SELECT 'appointments', COUNT(*) FROM "Appointment" WHERE "businessId" IS NULL;
```

### 5. Валидация функциональности
1. Проверьте что существующие пользователи могут войти
2. Проверьте что они видят свои данные
3. Проверьте публичную страницу `/book/{slug}`

## Важные моменты

### Безопасность
- Все публичные API теперь требуют `slug` параметр
- Все защищенные API фильтруются по `businessId` пользователя
- Каскадное удаление обеспечивает целостность данных

### URL изменения
- Публичная запись теперь доступна по `/book/{slug}`
- `{slug}` - это уникальный идентификатор бизнеса

### Роли пользователей
- **OWNER** - владелец бизнеса, полный доступ
- **STAFF** - сотрудник, ограниченный доступ
- **SUPERADMIN** - супервизор системы

### Обратная совместимость
- Существующие пользователи автоматически получают свой бизнес
- Все существующие данные сохраняются и привязываются к первому бизнесу

## Rollback план

Если что-то пойдет не так:
```bash
pg_dump bloknot_prod > backup_after_migration.sql
psql -d bloknot_prod < backup_before_migration.sql
```

## Тестирование

1. Создайте тестового пользователя
2. Убедитесь что ему создался бизнес
3. Добавьте услуги/мастеров
4. Проверьте публичную страницу по slug
5. Пригласите сотрудника и проверьте его доступ
