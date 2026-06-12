-- Создание таблицы для VK кодов привязки
CREATE TABLE IF NOT EXISTS "vk_link_codes" (
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
    "usedAt" TIMESTAMP NULL,
    
    FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE
);

-- Индекс для быстрого поиска кодов
CREATE INDEX IF NOT EXISTS "idx_vk_link_codes_code" ON "vk_link_codes"("code");
CREATE INDEX IF NOT EXISTS "idx_vk_link_codes_unused" ON "vk_link_codes"("isUsed", "expiresAt");
