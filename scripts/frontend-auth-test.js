// Frontend Auth Test Script
// Tests login, localStorage, and user loading

const API_URL = 'http://localhost:3001';

async function testPasswordLogin() {
  console.log('🧪 FRONTEND AUTH TEST');
  console.log('========================\n');

  // Test 1: Password Login
  console.log('📝 Test 1: Password Login');
  try {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'tml0ujehl@diemhenvn.com',
        password: '000000'
      })
    });

    const data = await res.json();
    
    if (!res.ok) {
      console.log('❌ Login failed:', data.error);
      return false;
    }

    console.log('✅ Login successful');
    console.log('📊 User data:', JSON.stringify(data.user, null, 2));

    if (!data.user) {
      console.log('❌ No user data in response');
      return false;
    }

    if (!data.user.id || !data.user.email) {
      console.log('❌ Missing required user fields (id, email)');
      return false;
    }

    console.log('✅ User has required fields (id, email)');

    // Simulate localStorage save
    const userString = JSON.stringify(data.user);
    console.log('✅ Simulated localStorage.setItem("user", JSON.stringify(data.user))');
    console.log('📦 Stored user:', userString);

    // Simulate localStorage load
    const loadedUser = JSON.parse(userString);
    console.log('✅ Simulated localStorage.getItem("user")');
    console.log('📦 Loaded user:', JSON.stringify(loadedUser, null, 2));

    if (loadedUser.email !== data.user.email) {
      console.log('❌ Loaded user data mismatch');
      return false;
    }

    console.log('✅ Loaded user data matches original');

  } catch (error) {
    console.log('❌ Test error:', error.message);
    return false;
  }

  // Test 2: Fetch with single json() call
  console.log('\n📝 Test 2: Single json() call pattern');
  try {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'tml0ujehl@diemhenvn.com',
        password: '000000'
      })
    });

    // Correct pattern: call json() only once
    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      console.log('❌ JSON parse error:', e.message);
      return false;
    }

    if (!res.ok) {
      console.log('❌ Request failed:', data?.error);
      return false;
    }

    console.log('✅ Single json() call pattern works');
    console.log('📊 Response data:', JSON.stringify(data, null, 2));

  } catch (error) {
    console.log('❌ Test error:', error.message);
    return false;
  }

  console.log('\n✅ FRONTEND AUTH TEST PASSED');
  console.log('========================');
  return true;
}

// Run test
testPasswordLogin()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  });
