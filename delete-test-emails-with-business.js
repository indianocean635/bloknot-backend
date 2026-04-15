#!/usr/bin/env node

/**
 * Complete deletion script for test emails WITH their businesses
 * This deletes businesses first, then users
 */

const { PrismaClient } = require('@prisma/client');

const testEmails = [
  'alyona.shadrina.9890@gmail.com',
  'reklama-media-kitchen@mail.ru', 
  'peskov142@mail.ru',
  'agent_123@internet.ru'
];

async function deleteTestEmailsWithBusiness() {
  const prisma = new PrismaClient();
  
  console.log('=== DELETING TEST EMAILS WITH THEIR BUSINESSES ===');
  
  try {
    for (const email of testEmails) {
      console.log(`\nProcessing: ${email}`);
      
      try {
        // Find user with their business
        const user = await prisma.user.findUnique({
          where: { email },
          include: { 
            business: true,
            ownedBusiness: true
          }
        });
        
        if (!user) {
          console.log(`  - User not found in database`);
          continue;
        }
        
        console.log(`  - Found user: ${user.email} (ID: ${user.id})`);
        
        // Get the business (either owned or associated)
        const business = user.ownedBusiness || user.business;
        
        if (business) {
          console.log(`  - Found business: ${business.name} (ID: ${business.id})`);
          
          // Delete business-related data in order
          
          // Delete appointments
          await prisma.appointment.deleteMany({
            where: { businessId: business.id }
          });
          console.log(`  - Deleted appointments`);
          
          // Delete services
          await prisma.service.deleteMany({
            where: { businessId: business.id }
          });
          console.log(`  - Deleted services`);
          
          // Delete masters
          await prisma.master.deleteMany({
            where: { businessId: business.id }
          });
          console.log(`  - Deleted masters`);
          
          // Delete categories
          await prisma.category.deleteMany({
            where: { businessId: business.id }
          });
          console.log(`  - Deleted categories`);
          
          // Delete branches
          await prisma.branch.deleteMany({
            where: { businessId: business.id }
          });
          console.log(`  - Deleted branches`);
          
          // Delete work photos
          await prisma.workPhoto.deleteMany({
            where: { businessId: business.id }
          });
          console.log(`  - Deleted work photos`);
          
          // Delete the business
          await prisma.business.delete({
            where: { id: business.id }
          });
          console.log(`  - Deleted business: ${business.name}`);
        }
        
        // Delete user-related data
        
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
  
  console.log('\n=== COMPLETE DELETION FINISHED ===');
}

if (require.main === module) {
  deleteTestEmailsWithBusiness().catch(console.error);
}

module.exports = deleteTestEmailsWithBusiness;
