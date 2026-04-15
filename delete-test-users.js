#!/usr/bin/env node

/**
 * Delete test users from database
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const testEmails = [
  'alyona.shadrina.9890@gmail.com',
  'reklama-media-kitchen@mail.ru', 
  'peskov142@mail.ru',
  'agent_123@internet.ru'
];

async function deleteTestUsers() {
  console.log('=== DELETING TEST USERS ===');
  
  for (const email of testEmails) {
    try {
      // Find user
      const user = await prisma.user.findUnique({
        where: { email },
        include: {
          ownedBusiness: true,
          business: true,
          staffProfile: true,
          loginTokens: true
        }
      });
      
      if (!user) {
        console.log(`User ${email} not found`);
        continue;
      }
      
      console.log(`\nDeleting user: ${email} (ID: ${user.id})`);
      
      // Delete related data first
      console.log('  - Deleting login tokens...');
      await prisma.loginToken.deleteMany({
        where: { userId: user.id }
      });
      
      if (user.staffProfile) {
        console.log('  - Deleting staff profile...');
        await prisma.staff.delete({
          where: { userId: user.id }
        });
      }
      
      if (user.ownedBusiness) {
        console.log('  - User owns business, cannot delete (delete business first)');
        continue;
      }
      
      // Delete the user
      console.log('  - Deleting user...');
      await prisma.user.delete({
        where: { id: user.id }
      });
      
      console.log(`  - Successfully deleted ${email}`);
      
    } catch (error) {
      console.error(`Error deleting ${email}:`, error.message);
    }
  }
  
  console.log('\n=== DELETION COMPLETE ===');
  
  await prisma.$disconnect();
}

if (require.main === module) {
  deleteTestUsers().catch(console.error);
}

module.exports = deleteTestUsers;
