-- Создание таблицы VK кодов привязки
CREATE TABLE IF NOT EXISTS "VKLinkCode" (
    "id" SERIAL PRIMARY KEY,
    "code" VARCHAR(10) UNIQUE NOT NULL, -- VK-XXXXXX
    "businessId" TEXT NOT NULL,
    "appointmentId" INTEGER NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "vkUserId" BIGINT NULL, -- VK User ID после привязки
    "isUsed" BOOLEAN DEFAULT FALSE,
    "expiresAt" TIMESTAMP NOT NULL,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP NULL
);

-- Создание индексов
CREATE INDEX IF NOT EXISTS "IDX_VKLinkCode_code" ON "VKLinkCode"("code");
CREATE INDEX IF NOT EXISTS "IDX_VKLinkCode_unused" ON "VKLinkCode"("isUsed", "expiresAt");

-- Добавление связи с appointments (если нужно)
-- ALTER TABLE "VKLinkCode" ADD CONSTRAINT "FK_VKLinkCode_appointment" 
-- FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE;
