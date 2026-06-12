-- SQL для создания таблицы VKLinkCode
-- Выполните этот SQL в вашей базе данных PostgreSQL

-- Создание таблицы
CREATE TABLE IF NOT EXISTS "VKLinkCode" (
    "id" SERIAL PRIMARY KEY,
    "code" VARCHAR(10) UNIQUE NOT NULL,
    "businessId" TEXT NOT NULL,
    "appointmentId" INTEGER NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "vkUserId" BIGINT NULL,
    "isUsed" BOOLEAN DEFAULT FALSE,
    "expiresAt" TIMESTAMP NOT NULL,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP NULL
);

-- Создание индексов
CREATE INDEX IF NOT EXISTS "IDX_VKLinkCode_code" ON "VKLinkCode"("code");
CREATE INDEX IF NOT EXISTS "IDX_VKLinkCode_unused" ON "VKLinkCode"("isUsed", "expiresAt");

-- Проверка что таблица создана
SELECT * FROM "VKLinkCode" LIMIT 1;
