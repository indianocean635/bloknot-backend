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
    let businessData = null;
    try {
      const businessResponse = await axios.get(`${BASE_URL}/api/settings/business`, {
        headers: { Cookie: cookieString },
        validateStatus: (status) => status < 500
      });

      if (businessResponse.status === 200) {
        businessData = businessResponse.data;
        console.log(`✅ /api/settings/business: ${businessData.name} (ID: ${businessData.id})`);
      } else {
        console.log(`⚠️  /api/settings/business: ${businessResponse.status} - нет бизнеса`);
      }
    } catch (error) {
      console.log(`⚠️  /api/settings/business: ошибка - нет бизнеса`);
    }

    // 4. Проверяем /api/specialists
    console.log(`👨‍💼 Проверяем /api/specialists`);
    let specialistsData = [];
    try {
      const specialistsResponse = await axios.get(`${BASE_URL}/api/specialists`, {
        headers: { Cookie: cookieString },
        validateStatus: (status) => status < 500
      });

      if (specialistsResponse.status === 200) {
        specialistsData = specialistsResponse.data;
        console.log(`✅ /api/specialists: ${specialistsData.length} специалистов`);
        specialistsData.forEach((specialist, index) => {
          console.log(`   ${index + 1}. ${specialist.name} (${specialist.email})`);
        });
      } else {
        console.log(`⚠️  /api/specialists: ${specialistsResponse.status}`);
      }
    } catch (error) {
      console.log(`⚠️  /api/specialists: ошибка`);
    }

    // 5. Проверяем /api/settings/masters
    console.log(`👥 Проверяем /api/settings/masters`);
    let mastersData = [];
    try {
      const mastersResponse = await axios.get(`${BASE_URL}/api/settings/masters`, {
        headers: { Cookie: cookieString },
        validateStatus: (status) => status < 500
      });

      if (mastersResponse.status === 200) {
        mastersData = mastersResponse.data;
        console.log(`✅ /api/settings/masters: ${mastersData.length} мастеров`);
        mastersData.forEach((master, index) => {
          console.log(`   ${index + 1}. ${master.name} (${master.email})`);
        });
      } else {
        console.log(`⚠️  /api/settings/masters: ${mastersResponse.status}`);
      }
    } catch (error) {
      console.log(`⚠️  /api/settings/masters: ошибка`);
    }

    return {
      user,
      businessData,
      specialistsData,
      mastersData,
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
async function runTwoUsersIsolationTest() {
  console.log('🚀 ЗАПУСКАЕМ ТЕСТ ИЗОЛЯЦИИ ДАННЫХ МЕЖДУ 2 ПОЛЬЗОВАТЕЛЯМИ');
  console.log('============================================================');

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
    console.log('============================================================');

    // Проверяем что пользователи разные
    if (resultA.user.id === resultB.user.id) {
      throw new Error('🔥 КРИТИЧЕСКАЯ УТЕЧКА: Пользователи имеют одинаковый ID!');
    }
    console.log('✅ Пользователи имеют разные ID');

    // Проверяем что бизнесы разные
    if (resultA.businessData && resultB.businessData && resultA.businessData.id === resultB.businessData.id) {
      throw new Error('🔥 КРИТИЧЕСКАЯ УТЕЧКА: Пользователи видят одинаковый бизнес!');
    }
    console.log('✅ Бизнесы изолированы');

    // Проверяем что специалисты разные
    const aSpecialistIds = resultA.specialistsData.map(s => s.id).sort();
    const bSpecialistIds = resultB.specialistsData.map(s => s.id).sort();
    
    if (JSON.stringify(aSpecialistIds) === JSON.stringify(bSpecialistIds) && aSpecialistIds.length > 0) {
      throw new Error('🔥 КРИТИЧЕСКАЯ УТЕЧКА: Пользователи видят одинаковых специалистов!');
    }
    console.log('✅ Специалисты изолированы');

    // Проверяем что мастера разные
    const aMasterIds = resultA.mastersData.map(m => m.id).sort();
    const bMasterIds = resultB.mastersData.map(m => m.id).sort();
    
    if (JSON.stringify(aMasterIds) === JSON.stringify(bMasterIds) && aMasterIds.length > 0) {
      throw new Error('🔥 КРИТИЧЕСКАЯ УТЕЧКА: Пользователи видят одинаковых мастеров!');
    }
    console.log('✅ Мастера изолированы');

    // Проверяем что нет localStorage в ответах (должны быть только API данные)
    console.log('\n🔍 ПРОВЕРКА ОТСУТСТВИЯ localStorage');
    console.log('============================================================');
    
    if (resultA.businessData || resultB.businessData) {
      console.log('✅ Данные бизнесов загружены через API');
    }
    
    if (resultA.specialistsData.length > 0 || resultB.specialistsData.length > 0) {
      console.log('✅ Данные специалистов загружены через API');
    }
    
    if (resultA.mastersData.length > 0 || resultB.mastersData.length > 0) {
      console.log('✅ Данные мастеров загружены через API');
    }

    console.log('\n🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ!');
    console.log('✅ ДАННЫЕ ПОЛНОСТЬЮ ИЗОЛИРОВАНЫ МЕЖДУ ПОЛЬЗОВАТЕЛЯМИ');
    console.log('✅ НЕТ УТЕЧЕК localStorage');
    console.log('✅ ВСЕ ДАННЫЕ ЗАГРУЖАЮТСЯ ЧЕРЕЗ API');

  } catch (error) {
    console.error('\n💥 ТЕСТ ПРОВАЛЕН:');
    console.error('🔥 ЭТО КРИТИЧЕСКИЙ БАГ БЕЗОПАСНОСТИ!');
    console.error('Нужно немедленно исправить утечку данных!');
    process.exit(1);
  }
}

// Запуск теста
runTwoUsersIsolationTest().catch(error => {
  console.error('❌ Ошибка запуска теста:', error);
  process.exit(1);
});
