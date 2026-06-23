-- Добавление поля vkUserId в таблицу appointments
-- Выполните этот SQL в вашей базе данных PostgreSQL

-- Добавление поля vkUserId
ALTER TABLE "appointments" 
ADD COLUMN IF NOT EXISTS "vkUserId" BIGINT;

-- Создание индекса для vkUserId
CREATE INDEX IF NOT EXISTS "IDX_appointments_vkUserId" ON "appointments"("vkUserId");

-- Проверка что поле добавлено
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'appointments' AND column_name = 'vkUserId';
