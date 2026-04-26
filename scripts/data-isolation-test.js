const axios = require('axios');

// Конфигурация
const BASE_URL = 'http://localhost:3001';

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
    // 1. Логинимся
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
    const cookieString = cookiesToString(cookies);
    
    console.log(`✅ Логин успешен, cookie: ${Object.keys(cookies).join(', ')}`);

    // 2. Проверяем /api/auth/me
    console.log(`👤 Проверяем /api/auth/me`);
    const meResponse = await axios.get(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: cookieString },
      validateStatus: (status) => status < 500
    });

    if (meResponse.status !== 200) {
      throw new Error(`/api/auth/me failed: ${meResponse.status} - ${JSON.stringify(meResponse.data)}`);
    }

    const user = meResponse.data.user;
    console.log(`✅ /api/auth/me: ${user.email}, businessId: ${user.businessId}`);

    // 3. Проверяем /api/settings/business
    console.log(`🏢 Проверяем /api/settings/business`);
    const businessResponse = await axios.get(`${BASE_URL}/api/settings/business`, {
      headers: { Cookie: cookieString },
      validateStatus: (status) => status < 500
    });

    if (businessResponse.status !== 200) {
      throw new Error(`/api/settings/business failed: ${businessResponse.status}`);
    }

    const business = businessResponse.data;
    console.log(`✅ /api/settings/business: ${business.name} (ID: ${business.id})`);

    // 4. Проверяем /api/settings/branches
    console.log(`🏪 Проверяем /api/settings/branches`);
    const branchesResponse = await axios.get(`${BASE_URL}/api/settings/branches`, {
      headers: { Cookie: cookieString },
      validateStatus: (status) => status < 500
    });

    if (branchesResponse.status !== 200) {
      throw new Error(`/api/settings/branches failed: ${branchesResponse.status}`);
    }

    const branches = branchesResponse.data;
    console.log(`✅ /api/settings/branches: ${branches.length} филиалов`);

    // 5. Проверяем /api/settings/services
    console.log(`💇 Проверяем /api/settings/services`);
    const servicesResponse = await axios.get(`${BASE_URL}/api/settings/services`, {
      headers: { Cookie: cookieString },
      validateStatus: (status) => status < 500
    });

    if (servicesResponse.status !== 200) {
      throw new Error(`/api/settings/services failed: ${servicesResponse.status}`);
    }

    const services = servicesResponse.data;
    console.log(`✅ /api/settings/services: ${services.length} услуг`);

    // 6. Проверяем /api/settings/masters
    console.log(`👨‍💼 Проверяем /api/settings/masters`);
    const mastersResponse = await axios.get(`${BASE_URL}/api/settings/masters`, {
      headers: { Cookie: cookieString },
      validateStatus: (status) => status < 500
    });

    if (mastersResponse.status !== 200) {
      throw new Error(`/api/settings/masters failed: ${mastersResponse.status}`);
    }

    const masters = mastersResponse.data;
    console.log(`✅ /api/settings/masters: ${masters.length} мастеров`);

    // 7. Проверяем /api/settings/works
    console.log(`🖼️ Проверяем /api/settings/works`);
    const worksResponse = await axios.get(`${BASE_URL}/api/settings/works`, {
      headers: { Cookie: cookieString },
      validateStatus: (status) => status < 500
    });

    if (worksResponse.status !== 200) {
      throw new Error(`/api/settings/works failed: ${worksResponse.status}`);
    }

    const works = worksResponse.data;
    console.log(`✅ /api/settings/works: ${works.length} работ`);

    return {
      user,
      business,
      branches,
      services,
      masters,
      works,
      cookies
    };

  } catch (error) {
    console.error(`❌ Ошибка при тестировании ${testName}:`, error.message);
    if (error.response) {
      console.error(`Response: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

// Основной тест
async function runDataIsolationTest() {
  console.log('🚀 ЗАПУСКАЕМ ТЕСТ ИЗОЛЯЦИИ ДАННЫХ');
  console.log('====================================');

  const userA = {
    email: 'test-user-a@example.com',
    password: 'password123'
  };

  const userB = {
    email: 'test-user-b@example.com', 
    password: 'password123'
  };

  try {
    // Тестируем пользователя A
    const resultA = await testUser(userA, 'USER_A');
    
    // Тестируем пользователя B
    const resultB = await testUser(userB, 'USER_B');

    // Проверяем изоляцию данных
    console.log('\n🔍 ПРОВЕРКА ИЗОЛЯЦИИ ДАННЫХ');
    console.log('====================================');

    // Проверяем что пользователи разные
    if (resultA.user.id === resultB.user.id) {
      throw new Error('🔥 КРИТИЧЕСКАЯ УТЕЧКА: Пользователи имеют одинаковый ID!');
    }
    console.log('✅ Пользователи имеют разные ID');

    // Проверяем что бизнесы разные
    if (resultA.business.id === resultB.business.id) {
      throw new Error('🔥 КРИТИЧЕСКАЯ УТЕЧКА: Пользователи видят одинаковый бизнес!');
    }
    console.log('✅ Бизнесы изолированы');

    // Проверяем что филиалы разные (если они есть)
    const aBranchIds = resultA.branches.map(b => b.id).sort();
    const bBranchIds = resultB.branches.map(b => b.id).sort();
    
    if (JSON.stringify(aBranchIds) === JSON.stringify(bBranchIds) && aBranchIds.length > 0) {
      throw new Error('🔥 КРИТИЧЕСКАЯ УТЕЧКА: Пользователи видят одинаковые филиалы!');
    }
    console.log('✅ Филиалы изолированы');

    // Проверяем что услуги разные (если они есть)
    const aServiceIds = resultA.services.map(s => s.id).sort();
    const bServiceIds = resultB.services.map(s => s.id).sort();
    
    if (JSON.stringify(aServiceIds) === JSON.stringify(bServiceIds) && aServiceIds.length > 0) {
      throw new Error('🔥 КРИТИЧЕСКАЯ УТЕЧКА: Пользователи видят одинаковые услуги!');
    }
    console.log('✅ Услуги изолированы');

    // Проверяем что мастера разные (если они есть)
    const aMasterIds = resultA.masters.map(m => m.id).sort();
    const bMasterIds = resultB.masters.map(m => m.id).sort();
    
    if (JSON.stringify(aMasterIds) === JSON.stringify(bMasterIds) && aMasterIds.length > 0) {
      throw new Error('🔥 КРИТИЧЕСКАЯ УТЕЧКА: Пользователи видят одинаковых мастеров!');
    }
    console.log('✅ Мастера изолированы');

    // Проверяем что работы разные (если они есть)
    const aWorkIds = resultA.works.map(w => w.id).sort();
    const bWorkIds = resultB.works.map(w => w.id).sort();
    
    if (JSON.stringify(aWorkIds) === JSON.stringify(bWorkIds) && aWorkIds.length > 0) {
      throw new Error('🔥 КРИТИЧЕСКАЯ УТЕЧКА: Пользователи видят одинаковые работы!');
    }
    console.log('✅ Работы изолированы');

    console.log('\n🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ!');
    console.log('✅ ДАННЫЕ ПОЛНОСТЬЮ ИЗОЛИРОВАНЫ');
    console.log('✅ НЕТ УТЕЧЕК МЕЖДУ ПОЛЬЗОВАТЕЛЯМИ');

  } catch (error) {
    console.error('\n💥 ТЕСТ ПРОВАЛЕН:');
    console.error('🔥 ЭТО КРИТИЧЕСКИЙ БАГ БЕЗОПАСНОСТИ!');
    console.error('Нужно немедленно исправить утечку данных!');
    process.exit(1);
  }
}

// Запуск теста
runDataIsolationTest().catch(error => {
  console.error('❌ Ошибка запуска теста:', error);
  process.exit(1);
});
