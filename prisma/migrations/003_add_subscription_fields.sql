-- Add subscription fields to User model
-- Migration: Add CloudPayments subscription support

ALTER TABLE "User" 
ADD COLUMN "subscriptionStatus" TEXT DEFAULT 'trial',
ADD COLUMN "subscriptionType" TEXT,
ADD COLUMN "trialEndsAt" TIMESTAMP(3),
ADD COLUMN "subscriptionEndsAt" TIMESTAMP(3),
ADD COLUMN "cloudPaymentsSubscriptionId" TEXT,
ADD COLUMN "cloudPaymentsCardToken" TEXT,
ADD COLUMN "nextPaymentDate" TIMESTAMP(3);

-- Create indexes for subscription fields
CREATE INDEX "User_subscriptionStatus_idx" ON "User"("subscriptionStatus");
CREATE INDEX "User_subscriptionEndsAt_idx" ON "User"("subscriptionEndsAt");
CREATE INDEX "User_nextPaymentDate_idx" ON "User"("nextPaymentDate");

-- Add comments for documentation
COMMENT ON COLUMN "User"."subscriptionStatus" IS 'Subscription status: trial, active, cancelled, expired';
COMMENT ON COLUMN "User"."subscriptionType" IS 'Subscription type: monthly, yearly';
COMMENT ON COLUMN "User"."trialEndsAt" IS 'End date of trial period';
COMMENT ON COLUMN "User"."subscriptionEndsAt" IS 'End date of current subscription';
COMMENT ON COLUMN "User"."cloudPaymentsSubscriptionId" IS 'CloudPayments subscription ID';
COMMENT ON COLUMN "User"."cloudPaymentsCardToken" IS 'CloudPayments card token';
COMMENT ON COLUMN "User"."nextPaymentDate" IS 'Next automatic payment date';
