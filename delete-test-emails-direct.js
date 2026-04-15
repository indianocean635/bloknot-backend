#!/usr/bin/env node

/**
 * Direct database deletion script for test emails
 * This bypasses API and deletes directly from database
 */

const { PrismaClient } = require('@prisma/client');

const testEmails = [
  'alyona.shadrina.9890@gmail.com',
  'reklama-media-kitchen@mail.ru', 
  'peskov142@mail.ru',
  'agent_123@internet.ru'
];

async function deleteTestEmailsDirect() {
  const prisma = new PrismaClient();
  
  console.log('=== DELETING TEST EMAILS DIRECTLY FROM DATABASE ===');
  
  try {
    for (const email of testEmails) {
      console.log(`\nProcessing: ${email}`);
      
      try {
        // Find user first
        const user = await prisma.user.findUnique({
          where: { email },
          include: { business: true }
        });
        
        if (!user) {
          console.log(`  - User not found in database`);
          continue;
        }
        
        console.log(`  - Found user: ${user.email} (ID: ${user.id})`);
        
        // Check if user owns a business
        if (user.business || user.ownedBusiness) {
          console.log(`  - WARNING: User owns business, skipping deletion`);
          continue;
        }
        
        // Delete related data in order (respect foreign keys)
        
        // Delete login tokens
        await prisma.loginToken.deleteMany({
          where: { userId: user.id }
        });
        console.log(`  - Deleted login tokens`);
        
        // Delete staff profile
        await prisma.staffProfile.deleteMany({
          where: { userId: user.id }
        });
        console.log(`  - Deleted staff profile`);
        
        // Delete the user
        await prisma.user.delete({
          where: { id: user.id }
        });
        console.log(`  - Successfully deleted user ${email}`);
        
      } catch (error) {
        console.error(`  - Error deleting ${email}:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('Database connection error:', error);
  } finally {
    await prisma.$disconnect();
  }
  
  console.log('\n=== DELETION COMPLETE ===');
}

if (require.main === module) {
  deleteTestEmailsDirect().catch(console.error);
}

module.exports = deleteTestEmailsDirect;
