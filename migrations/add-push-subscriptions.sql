-- Migration: Add PushSubscription table for push notifications
-- Created: 2026-07-01
-- Description: Adds support for Firebase Cloud Messaging push notifications

-- Create PushSubscription table
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT,
    "businessId" TEXT,
    "userAgent" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActive" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- Create unique index on token
CREATE UNIQUE INDEX "PushSubscription_token_key" ON "PushSubscription"("token");

-- Create indexes for performance
CREATE INDEX "PushSubscription_businessId_isActive_idx" ON "PushSubscription"("businessId", "isActive");
CREATE INDEX "PushSubscription_userId_isActive_idx" ON "PushSubscription"("userId", "isActive");
CREATE INDEX "PushSubscription_token_idx" ON "PushSubscription"("token");

-- Add foreign key constraints
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_businessId_fkey" 
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add relation to User model (handled by Prisma)
-- Add relation to Business model (handled by Prisma)
