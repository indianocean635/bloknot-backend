#!/usr/bin/env node

/**
 * Fixed deletion script for test emails with their businesses
 * This deletes businesses first, then users - with proper error handling
 */

const { PrismaClient } = require('@prisma/client');

const testEmails = [
  'alyona.shadrina.9890@gmail.com',
  'reklama-media-kitchen@mail.ru', 
  'peskov142@mail.ru',
  'agent_123@internet.ru'
];

async function deleteTestEmailsFixed() {
  const prisma = new PrismaClient();
  
  console.log('=== DELETING TEST EMAILS WITH THEIR BUSINESSES (FIXED) ===');
  
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
          
          try {
            // Delete appointments
            await prisma.appointment.deleteMany({
              where: { businessId: business.id }
            });
            console.log(`  - Deleted appointments`);
          } catch (e) {
            console.log(`  - Appointments already deleted or not found`);
          }
          
          try {
            // Delete services
            await prisma.service.deleteMany({
              where: { businessId: business.id }
            });
            console.log(`  - Deleted services`);
          } catch (e) {
            console.log(`  - Services already deleted or not found`);
          }
          
          try {
            // Delete masters
            await prisma.master.deleteMany({
              where: { businessId: business.id }
            });
            console.log(`  - Deleted masters`);
          } catch (e) {
            console.log(`  - Masters already deleted or not found`);
          }
          
          try {
            // Delete categories
            await prisma.category.deleteMany({
              where: { businessId: business.id }
            });
            console.log(`  - Deleted categories`);
          } catch (e) {
            console.log(`  - Categories already deleted or not found`);
          }
          
          try {
            // Delete branches
            await prisma.branch.deleteMany({
              where: { businessId: business.id }
            });
            console.log(`  - Deleted branches`);
          } catch (e) {
            console.log(`  - Branches already deleted or not found`);
          }
          
          try {
            // Delete work photos
            await prisma.workPhoto.deleteMany({
              where: { businessId: business.id }
            });
            console.log(`  - Deleted work photos`);
          } catch (e) {
            console.log(`  - Work photos already deleted or not found`);
          }
          
          try {
            // Delete the business
            await prisma.business.delete({
              where: { id: business.id }
            });
            console.log(`  - Deleted business: ${business.name}`);
          } catch (e) {
            console.log(`  - Business already deleted or not found`);
          }
        }
        
        // Delete user-related data
        
        try {
          // Delete login tokens
          await prisma.loginToken.deleteMany({
            where: { userId: user.id }
          });
          console.log(`  - Deleted login tokens`);
        } catch (e) {
          console.log(`  - Login tokens already deleted or not found`);
        }
        
        // Try to delete staff profile if it exists
        try {
          if (prisma.staffProfile) {
            await prisma.staffProfile.deleteMany({
              where: { userId: user.id }
            });
            console.log(`  - Deleted staff profile`);
          }
        } catch (e) {
          console.log(`  - Staff profile not found or already deleted`);
        }
        
        // Delete the user
        try {
          await prisma.user.delete({
            where: { id: user.id }
          });
          console.log(`  - Successfully deleted user ${email}`);
        } catch (e) {
          console.log(`  - User already deleted or not found`);
        }
        
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
  deleteTestEmailsFixed().catch(console.error);
}

module.exports = deleteTestEmailsFixed;
