-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN "subscriptionStatus" TEXT NOT NULL DEFAULT 'TRIAL';
ALTER TABLE "Subscription" ADD COLUMN "trialEndsAt" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN "subscriptionEndsAt" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN "cloudpaymentsSubscriptionId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "nextPaymentDate" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN "billingPeriod" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "lastPaymentAt" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN "usersLimit" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_cloudpaymentsSubscriptionId_key" ON "Subscription"("cloudpaymentsSubscriptionId");
