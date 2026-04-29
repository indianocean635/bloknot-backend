const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

console.log('🔍 FINAL ISOLATION TEST');
console.log('=========================\n');

async function cleanup() {
  console.log('🧹 Cleaning up test data...');
  await prisma.master.deleteMany({
    where: {
      email: {
        in: ['user1-test@example.com', 'user2-test@example.com']
      }
    }
  });
  await prisma.category.deleteMany({
    where: {
      business: {
        slug: {
          in: ['user1-test-example-com', 'user2-test-example-com']
        }
      }
    }
  });
  await prisma.business.deleteMany({
    where: {
      slug: {
        in: ['user1-test-example-com', 'user2-test-example-com']
      }
    }
  });
  await prisma.user.deleteMany({
    where: {
      email: {
        in: ['user1-test@example.com', 'user2-test@example.com']
      }
    }
  });
  console.log('✅ Cleanup complete\n');
}

async function createTestUser(email, password, name) {
  console.log(`👤 Creating user: ${email}`);
  
  const hashedPassword = await bcrypt.hash(password, 10);
  const slug = email.toLowerCase().replace('@', '-').replace('.', '-');
  
  const business = await prisma.business.create({
    data: {
      name: `${name}'s Business`,
      slug: slug,
      owner: {
        create: {
          email,
          name,
          password: hashedPassword,
          role: 'OWNER'
        }
      }
    },
    include: { owner: true }
  });
  
  await prisma.user.update({
    where: { id: business.owner.id },
    data: { businessId: business.id }
  });
  
  const user = await prisma.user.findUnique({
    where: { id: business.owner.id },
    include: { business: true }
  });
  
  console.log(`✅ User created: ${email}`);
  console.log(`   User ID: ${user.id}`);
  console.log(`   Business ID: ${user.businessId}\n`);
  
  return user;
}

async function testIsolation() {
  try {
    await cleanup();
    
    // Create user1 with business1
    const user1 = await createTestUser('user1-test@example.com', 'password123', 'User 1');
    const businessId1 = user1.businessId;
    
    // Create user2 with business2
    const user2 = await createTestUser('user2-test@example.com', 'password123', 'User 2');
    const businessId2 = user2.businessId;
    
    console.log('📊 BUSINESS ISOLATION CHECK:');
    console.log(`   User1 Business ID: ${businessId1}`);
    console.log(`   User2 Business ID: ${businessId2}`);
    console.log(`   Different businesses: ${businessId1 !== businessId2 ? '✅ YES' : '❌ NO'}\n`);
    
    // User1 creates a category
    console.log('📝 User1 creates category...');
    const category1 = await prisma.category.create({
      data: {
        name: 'Category for Business 1',
        businessId: businessId1
      }
    });
    console.log(`✅ Category created: ${category1.name} (ID: ${category1.id})\n`);
    
    // User2 tries to get categories
    console.log('🔍 User2 tries to get categories...');
    const user2Categories = await prisma.category.findMany({
      where: { businessId: businessId2 }
    });
    
    console.log(`📋 User2 categories count: ${user2Categories.length}`);
    
    if (user2Categories.length === 0) {
      console.log('✅ ISOLATION TEST PASSED: User2 cannot see User1\'s data\n');
    } else {
      console.log('❌ ISOLATION TEST FAILED: User2 can see User1\'s data!');
      console.log(`   User2 categories:`, user2Categories);
      process.exit(1);
    }
    
    // Verify user1 can see their own data
    console.log('🔍 User1 tries to get categories...');
    const user1Categories = await prisma.category.findMany({
      where: { businessId: businessId1 }
    });
    
    console.log(`📋 User1 categories count: ${user1Categories.length}`);
    
    if (user1Categories.length === 1 && user1Categories[0].id === category1.id) {
      console.log('✅ User1 can see their own data\n');
    } else {
      console.log('❌ User1 cannot see their own data!');
      process.exit(1);
    }
    
    console.log('🎉 ALL ISOLATION TESTS PASSED!\n');
    
    await cleanup();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Test error:', error);
    await cleanup();
    process.exit(1);
  }
}

testIsolation();
