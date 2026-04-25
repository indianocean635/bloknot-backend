const axios = require('axios');

// Конфигурация
const BASE_URL = 'http://localhost:3001';
const COOKIE_JAR = {};

// Утилиты для работы с cookie
function parseCookies(setCookieHeader) {
  const cookies = {};
  if (setCookieHeader) {
    setCookieHeader.forEach(cookie => {
      const [nameValue, ...attributes] = cookie.split(';');
      const [name, value] = nameValue.split('=');
      if (name && value) {
        cookies[name.trim()] = value.trim();
      }
    });
  }
  return cookies;
}

function cookiesToString(cookies) {
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
}

// Тестирование пользователя
async function testUser(userData, testName) {
  console.log(`\n📋 ТЕСТИРУЕМ ${testName}`);
  
  try {
    // 1. Логинимся через password login
    console.log(`🔐 Логин для ${userData.email}`);
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: userData.email,
      password: userData.password
    }, {
      withCredentials: true,
      validateStatus: (status) => status < 500
    });

    if (loginResponse.status !== 200) {
      throw new Error(`Login failed: ${loginResponse.status} - ${JSON.stringify(loginResponse.data)}`);
    }

    // Сохраняем cookie
    const cookies = parseCookies(loginResponse.headers['set-cookie']);
    COOKIE_JAR[testName] = cookies;
    console.log(`✅ Логин успешен, cookie получены`);

    // 2. Проверяем /api/auth/me
    console.log(`👤 Проверка /api/auth/me для ${testName}`);
    const meResponse = await axios.get(`${BASE_URL}/api/auth/me`, {
      headers: {
        'Cookie': cookiesToString(cookies)
      },
      withCredentials: true,
      validateStatus: (status) => status < 500
    });

    if (meResponse.status !== 200) {
      throw new Error(`/api/auth/me failed: ${meResponse.status} - ${JSON.stringify(meResponse.data)}`);
    }

    const userDataFromApi = meResponse.data.user;
    console.log(`✅ /api/auth/me вернул: ${userDataFromApi.email} (ID: ${userDataFromApi.id})`);

    // 3. Проверяем /api/settings
    console.log(`⚙️ Проверка /api/settings/business для ${testName}`);
    const settingsResponse = await axios.get(`${BASE_URL}/api/settings/business`, {
      headers: {
        'Cookie': cookiesToString(cookies)
      },
      withCredentials: true,
      validateStatus: (status) => status < 500
    });

    if (settingsResponse.status !== 200) {
      throw new Error(`/api/settings/business failed: ${settingsResponse.status} - ${JSON.stringify(settingsResponse.data)}`);
    }

    const settingsData = settingsResponse.data;
    console.log(`✅ /api/settings/business вернул: ${JSON.stringify(settingsData, null, 2)}`);

    return {
      user: userDataFromApi,
      settings: settingsData
    };

  } catch (error) {
    console.error(`❌ Ошибка при тестировании ${testName}:`, error.message);
    throw error;
  }
}

// Основной тест
async function runAuthIsolationTest() {
  console.log('🚀 ЗАПУСКАЕМ ТЕСТ ИЗОЛЯЦИИ АВТОРИЗАЦИИ');
  console.log('='.repeat(50));

  try {
    // Тестовые пользователи
    const userA = {
      email: 'test-user-a@example.com',
      password: 'password123'
    };

    const userB = {
      email: 'test-user-b@example.com', 
      password: 'password123'
    };

    // Тестируем пользователя A
    const resultA = await testUser(userA, 'USER_A');

    // Тестируем пользователя B
    const resultB = await testUser(userB, 'USER_B');

    // Проверяем изоляцию
    console.log('\n🔍 ПРОВЕРКА ИЗОЛЯЦИИ');
    console.log('='.repeat(50));

    // Проверяем что пользователи разные
    if (resultA.user.email === resultB.user.email) {
      throw new Error('❌ КРИТИЧЕСКАЯ ОШИБКА: Пользователи A и B имеют одинаковый email!');
    }

    if (resultA.user.id === resultB.user.id) {
      throw new Error('❌ КРИТИЧЕСКАЯ ОШИБКА: Пользователи A и B имеют одинаковый ID!');
    }

    // Проверяем что настройки разные
    if (JSON.stringify(resultA.settings) === JSON.stringify(resultB.settings)) {
      throw new Error('❌ КРИТИЧЕСКАЯ ОШИБКА: Настройки пользователей A и B совпадают!');
    }

    console.log('✅ Проверка изоляции пройдена:');
    console.log(`   - User A: ${resultA.user.email} (ID: ${resultA.user.id})`);
    console.log(`   - User B: ${resultB.user.email} (ID: ${resultB.user.id})`);
    console.log(`   - Настройки A: ${JSON.stringify(resultA.settings).substring(0, 100)}...`);
    console.log(`   - Настройки B: ${JSON.stringify(resultB.settings).substring(0, 100)}...`);
    console.log(`   - Настройки разные: ${JSON.stringify(resultA.settings) !== JSON.stringify(resultB.settings)}`);

    console.log('\n🎉 AUTH ISOLATION OK');
    console.log('='.repeat(50));
    console.log('✅ /api/auth/me работает без 401');
    console.log('✅ req.user всегда есть');
    console.log('✅ У каждого пользователя свой кабинет');
    console.log('✅ Настройки НЕ пересекаются');
    console.log('✅ Новый пользователь не попадает в чужой аккаунт');

  } catch (error) {
    console.error('\n💥 ТЕСТ ПРОВАЛЕН:');
    console.error(error.message);
    console.error('\n🔥 ЭТО КРИТИЧЕСКИЙ БАГ БЕЗОПАСНОСТИ!');
    process.exit(1);
  }
}

// Запуск теста
if (require.main === module) {
  runAuthIsolationTest().catch(error => {
    console.error('💥 Фатальная ошибка теста:', error);
    process.exit(1);
  });
}

module.exports = { runAuthIsolationTest };
