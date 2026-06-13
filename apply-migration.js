const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('🔄 Applying subscription fields migration...');
    
    // Check if subscriptionStatus column exists
    const result = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'User' 
      AND column_name = 'subscriptionStatus'
    `;
    
    if (result.length === 0) {
      console.log('📝 Adding subscription fields to User table...');
      
      await prisma.$executeRaw`
        ALTER TABLE "User" 
        ADD COLUMN "subscriptionStatus" TEXT DEFAULT 'trial',
        ADD COLUMN "subscriptionType" TEXT,
        ADD COLUMN "trialEndsAt" TIMESTAMP(3),
        ADD COLUMN "subscriptionEndsAt" TIMESTAMP(3),
        ADD COLUMN "cloudPaymentsSubscriptionId" TEXT,
        ADD COLUMN "cloudPaymentsCardToken" TEXT,
        ADD COLUMN "nextPaymentDate" TIMESTAMP(3)
      `;
      
      console.log('✅ Subscription fields added successfully');
    } else {
      console.log('ℹ️ Subscription fields already exist');
    }
    
    // Update existing users to have trial status
    await prisma.$executeRaw`
      UPDATE "User" 
      SET "subscriptionStatus" = 'trial' 
      WHERE "subscriptionStatus" IS NULL
    `;
    
    console.log('✅ Existing users updated to trial status');
    
    // Set trial end date for existing users (5 days from now)
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 5);
    
    await prisma.$executeRaw`
      UPDATE "User" 
      SET "trialEndsAt" = ${trialEndDate} 
      WHERE "trialEndsAt" IS NULL AND "subscriptionStatus" = 'trial'
    `;
    
    console.log('✅ Trial end dates set for existing users');
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration()
  .then(() => {
    console.log('🎉 Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });
