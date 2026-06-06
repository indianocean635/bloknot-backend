-- Make Master.email field optional
-- This migration allows specialists to be created without email for SOLO plans

ALTER TABLE "Master" 
ALTER COLUMN "email" DROP NOT NULL;

-- This will allow NULL values in the email column
-- The unique constraint will still work for non-NULL values
