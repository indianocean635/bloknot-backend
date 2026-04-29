const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3001';
const TEST_EMAIL_1 = 'e2e-user1@example.com';
const TEST_EMAIL_2 = 'e2e-user2@example.com';
const TEST_PASSWORD = 'password123';

console.log('🎬 E2E REAL FLOW TEST');
console.log('======================\n');

let user1Token = null;
let user2Token = null;
let user1BusinessId = null;
let createdCategoryId = null;

async function request(method, path, data = null, token = null) {
  const url = `${BASE_URL}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Cookie': `auth=${token}` })
    },
    ...(data && { body: JSON.stringify(data) })
  };

  const response = await fetch(url, options);
  const text = await response.text();
  
  try {
    return {
      status: response.status,
      data: JSON.parse(text)
    };
  } catch {
    return {
      status: response.status,
      data: text
    };
  }
}

async function cleanup() {
  console.log('🧹 Cleaning up test data...');
  
  // Delete test users via direct Prisma
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  await prisma.category.deleteMany({
    where: {
      business: {
        slug: {
          in: ['e2e-user1-example-com', 'e2e-user2-example-com']
        }
      }
    }
  });
  await prisma.business.deleteMany({
    where: {
      slug: {
        in: ['e2e-user1-example-com', 'e2e-user2-example-com']
      }
    }
  });
  await prisma.user.deleteMany({
    where: {
      email: {
        in: [TEST_EMAIL_1, TEST_EMAIL_2]
      }
    }
  });
  
  await prisma.$disconnect();
  console.log('✅ Cleanup complete\n');
}

async function step1_registerUser1() {
  console.log('📝 STEP 1: Register user1');
  
  const result = await request('POST', '/api/magic/request-login', {
    email: TEST_EMAIL_1,
    password: TEST_PASSWORD
  });
  
  if (result.status === 200) {
    console.log('✅ User1 registered successfully');
    console.log(`   Response:`, result.data);
    return true;
  } else {
    console.log('❌ User1 registration failed');
    console.log(`   Status: ${result.status}`);
    console.log(`   Response:`, result.data);
    return false;
  }
}

async function step2_loginUser1() {
  console.log('\n🔐 STEP 2: Login user1');
  
  const result = await request('POST', '/api/auth/login', {
    email: TEST_EMAIL_1,
    password: TEST_PASSWORD
  });
  
  if (result.status === 200 && result.data.success) {
    user1Token = result.data.token || result.data.user?.token;
    user1BusinessId = result.data.user?.businessId;
    console.log('✅ User1 logged in successfully');
    console.log(`   User ID: ${result.data.user?.id}`);
    console.log(`   Email: ${result.data.user?.email}`);
    console.log(`   Business ID: ${result.data.user?.businessId}`);
    console.log(`   Token: ${user1Token ? 'Present' : 'Missing'}`);
    return true;
  } else {
    console.log('❌ User1 login failed');
    console.log(`   Status: ${result.status}`);
    console.log(`   Response:`, result.data);
    return false;
  }
}

async function step3_getAuthMe() {
  console.log('\n👤 STEP 3: GET /api/auth/me for user1');
  
  const result = await request('GET', '/api/auth/me', null, user1Token);
  
  if (result.status === 200) {
    const { id, email, businessId } = result.data.user || result.data;
    console.log('✅ /api/auth/me returned user data');
    console.log(`   ID: ${id}`);
    console.log(`   Email: ${email}`);
    console.log(`   Business ID: ${businessId}`);
    
    if (id && email && businessId) {
      console.log('✅ All required fields present');
      return true;
    } else {
      console.log('❌ Missing required fields');
      return false;
    }
  } else {
    console.log('❌ /api/auth/me failed');
    console.log(`   Status: ${result.status}`);
    console.log(`   Response:`, result.data);
    return false;
  }
}

async function step4_createCategory() {
  console.log('\n📁 STEP 4: Create category for user1');
  
  const result = await request('POST', '/api/settings/categories', {
    name: 'E2E Test Category'
  }, user1Token);
  
  if (result.status === 200) {
    createdCategoryId = result.data.id;
    console.log('✅ Category created successfully');
    console.log(`   Category ID: ${createdCategoryId}`);
    console.log(`   Name: ${result.data.name}`);
    return true;
  } else {
    console.log('❌ Category creation failed');
    console.log(`   Status: ${result.status}`);
    console.log(`   Response:`, result.data);
    return false;
  }
}

async function step5_registerUser2() {
  console.log('\n📝 STEP 5: Register user2');
  
  const result = await request('POST', '/api/magic/request-login', {
    email: TEST_EMAIL_2,
    password: TEST_PASSWORD
  });
  
  if (result.status === 200) {
    console.log('✅ User2 registered successfully');
    console.log(`   Response:`, result.data);
    return true;
  } else {
    console.log('❌ User2 registration failed');
    console.log(`   Status: ${result.status}`);
    console.log(`   Response:`, result.data);
    return false;
  }
}

async function step6_loginUser2() {
  console.log('\n🔐 STEP 6: Login user2');
  
  const result = await request('POST', '/api/auth/login', {
    email: TEST_EMAIL_2,
    password: TEST_PASSWORD
  });
  
  if (result.status === 200 && result.data.success) {
    user2Token = result.data.token || result.data.user?.token;
    console.log('✅ User2 logged in successfully');
    console.log(`   User ID: ${result.data.user?.id}`);
    console.log(`   Email: ${result.data.user?.email}`);
    console.log(`   Business ID: ${result.data.user?.businessId}`);
    return true;
  } else {
    console.log('❌ User2 login failed');
    console.log(`   Status: ${result.status}`);
    console.log(`   Response:`, result.data);
    return false;
  }
}

async function step7_checkIsolation() {
  console.log('\n🔒 STEP 7: Check isolation - user2 tries to get categories');
  
  const result = await request('GET', '/api/settings/categories', null, user2Token);
  
  if (result.status === 200) {
    const categories = Array.isArray(result.data) ? result.data : [];
    console.log(`   User2 categories count: ${categories.length}`);
    
    if (categories.length === 0) {
      console.log('✅ ISOLATION TEST PASSED: User2 cannot see User1\'s data');
      return true;
    } else {
      console.log('❌ ISOLATION TEST FAILED: User2 can see User1\'s data!');
      console.log(`   Categories:`, categories);
      return false;
    }
  } else {
    console.log('❌ GET categories failed');
    console.log(`   Status: ${result.status}`);
    console.log(`   Response:`, result.data);
    return false;
  }
}

async function step8_verifyUser1CanSeeOwnData() {
  console.log('\n👁️ STEP 8: Verify user1 can see their own data');
  
  const result = await request('GET', '/api/settings/categories', null, user1Token);
  
  if (result.status === 200) {
    const categories = Array.isArray(result.data) ? result.data : [];
    console.log(`   User1 categories count: ${categories.length}`);
    
    if (categories.length === 1 && categories[0].id === createdCategoryId) {
      console.log('✅ User1 can see their own data');
      return true;
    } else {
      console.log('❌ User1 cannot see their own data');
      console.log(`   Categories:`, categories);
      return false;
    }
  } else {
    console.log('❌ GET categories failed');
    console.log(`   Status: ${result.status}`);
    console.log(`   Response:`, result.data);
    return false;
  }
}

async function step9_edgeCases() {
  console.log('\n🧪 STEP 9: Test edge cases');
  
  // Test with no token
  console.log('   Testing with no token...');
  const result1 = await request('GET', '/api/settings/categories');
  if (result1.status === 401 || result1.status === 403) {
    console.log('   ✅ No token → 401/403');
  } else {
    console.log('   ❌ No token should return 401/403');
    return false;
  }
  
  // Test with invalid token
  console.log('   Testing with invalid token...');
  const result2 = await request('GET', '/api/settings/categories', null, 'invalid-token');
  if (result2.status === 401 || result2.status === 403) {
    console.log('   ✅ Invalid token → 401/403');
  } else {
    console.log('   ❌ Invalid token should return 401/403');
    return false;
  }
  
  console.log('✅ All edge cases passed');
  return true;
}

async function runE2ETest() {
  try {
    await cleanup();
    
    const results = [];
    
    results.push(await step1_registerUser1());
    results.push(await step2_loginUser1());
    results.push(await step3_getAuthMe());
    results.push(await step4_createCategory());
    results.push(await step5_registerUser2());
    results.push(await step6_loginUser2());
    results.push(await step7_checkIsolation());
    results.push(await step8_verifyUser1CanSeeOwnData());
    results.push(await step9_edgeCases());
    
    console.log('\n📊 TEST RESULTS:');
    console.log('================');
    const passed = results.filter(r => r).length;
    const total = results.length;
    console.log(`Passed: ${passed}/${total}`);
    
    if (passed === total) {
      console.log('\n🎉 ALL E2E TESTS PASSED!');
      await cleanup();
      process.exit(0);
    } else {
      console.log('\n❌ SOME TESTS FAILED');
      await cleanup();
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ E2E test error:', error);
    await cleanup();
    process.exit(1);
  }
}

runE2ETest();
