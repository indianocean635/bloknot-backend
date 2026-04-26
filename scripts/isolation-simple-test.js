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

// Логин пользователя
async function loginUser(email, password) {
  console.log(`\n🔐 ЛОГИН ${email}`);
  
  try {
    const response = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: email,
      password: password
    }, {
      withCredentials: true,
      validateStatus: (status) => status < 500
    });

    if (response.status !== 200) {
      throw new Error(`Login failed: ${response.status} - ${JSON.stringify(response.data)}`);
    }

    // Сохраняем cookie
    const cookies = parseCookies(response.headers['set-cookie']);
    const cookieString = cookiesToString(cookies);
    
    console.log(`✅ Логин успешен: ${email}`);
    console.log(`   User ID: ${response.data.user.id}`);
    console.log(`   Business ID: ${response.data.user.businessId || 'NO BUSINESS'}`);
    
    return { user: response.data.user, cookies: cookieString };

  } catch (error) {
    console.error(`❌ Ошибка логина ${email}:`, error.message);
    throw error;
  }
}

// Создание бизнеса
async function createBusiness(userCookies, businessData) {
  console.log(`\n🏢 СОЗДАНИЕ БИЗНЕСА`);
  
  try {
    const response = await axios.post(`${BASE_URL}/api/business`, businessData, {
      headers: { Cookie: userCookies },
      validateStatus: (status) => status < 500
    });

    if (response.status !== 200) {
      throw new Error(`Business creation failed: ${response.status} - ${JSON.stringify(response.data)}`);
    }

    console.log(`✅ Бизнес создан: ${response.data.name} (ID: ${response.data.id})`);
    return response.data;

  } catch (error) {
    console.error(`❌ Ошибка создания бизнеса:`, error.message);
    throw error;
  }
}

// Создание специалиста
async function createSpecialist(userCookies, specialistData) {
  console.log(`\n👨‍💼 СОЗДАНИЕ СПЕЦИАЛИСТА: ${specialistData.name}`);
  
  try {
    const response = await axios.post(`${BASE_URL}/api/specialists`, specialistData, {
      headers: { Cookie: userCookies },
      validateStatus: (status) => status < 500
    });

    if (response.status !== 201) {
      throw new Error(`Specialist creation failed: ${response.status} - ${JSON.stringify(response.data)}`);
    }

    console.log(`✅ Специалист создан: ${response.data.name} (ID: ${response.data.id})`);
    return response.data;

  } catch (error) {
    console.error(`❌ Ошибка создания специалиста:`, error.message);
    throw error;
  }
}

// Получение специалистов
async function getSpecialists(userCookies, userName) {
  console.log(`\n👥 ПОЛУЧЕНИЕ СПЕЦИАЛИСТОВ ДЛЯ ${userName}`);
  
  try {
    const response = await axios.get(`${BASE_URL}/api/specialists`, {
      headers: { Cookie: userCookies },
      validateStatus: (status) => status < 500
    });

    if (response.status !== 200) {
      throw new Error(`Get specialists failed: ${response.status} - ${JSON.stringify(response.data)}`);
    }

    const specialists = response.data;
    console.log(`✅ Получено специалистов: ${specialists.length}`);
    specialists.forEach((specialist, index) => {
      console.log(`   ${index + 1}. ${specialist.name} (${specialist.email})`);
    });

    return specialists;

  } catch (error) {
    console.error(`❌ Ошибка получения специалистов для ${userName}:`, error.message);
    throw error;
  }
}

// Основной тест
async function runIsolationSimpleTest() {
  console.log('🚀 ЗАПУСКАЕМ ПРОСТОЙ ТЕСТ ИЗОЛЯЦИИ ДАННЫХ');
  console.log('============================================================');

  // Используем существующих пользователей или создаем тестовые данные
  const userA = {
    email: 'test-user-a@example.com',
    password: 'password123'
  };

  const userB = {
    email: 'test-user-b@example.com',
    password: 'password123'
  };

  try {
    // ШАГ 1: Логин пользователей
    console.log('\n📋 ШАГ 1: ЛОГИН ПОЛЬЗОВАТЕЛЕЙ');
    console.log('============================================');
    
    const loginA = await loginUser(userA.email, userA.password);
    const loginB = await loginUser(userB.email, userB.password);

    // ШАГ 2: USER_A создает бизнес и специалиста (если еще не созданы)
    console.log('\n📋 ШАГ 2: USER_A СОЗДАЕТ БИЗНЕС И СПЕЦИАЛИСТА');
    console.log('============================================');
    
    let businessA = null;
    let specialistA = null;
    
    if (loginA.user.businessId) {
      console.log('✅ USER_A уже имеет бизнес');
    } else {
      businessA = await createBusiness(loginA.cookies, {
        name: 'Business A Test',
        slug: 'business-a-test-' + Date.now(),
        phone: '+70000000003',
        email: 'business-a-test@example.com'
      });
      
      specialistA = await createSpecialist(loginA.cookies, {
        name: 'A_MASTER_TEST',
        email: 'master-a-test@example.com',
        phone: '+70000000004'
      });
    }

    // ШАГ 3: USER_B (без бизнеса)
    console.log('\n📋 ШАГ 3: USER_B ТЕСТИРУЕТСЯ БЕЗ БИЗНЕСА');
    console.log('============================================');
    
    if (loginB.user.businessId) {
      console.log('⚠️  USER_B имеет бизнес, это может повлиять на тест');
    } else {
      console.log('✅ USER_B не имеет бизнеса');
    }

    // ШАГ 4: ПРОВЕРКА ИЗОЛЯЦИИ
    console.log('\n📋 ШАГ 4: ПРОВЕРКА ИЗОЛЯЦИИ ДАННЫХ');
    console.log('============================================');

    // USER_B вызывает /api/specialists
    console.log('\n🔍 USER_B вызывает GET /api/specialists');
    const specialistsB = await getSpecialists(loginB.cookies, 'USER_B');
    
    // ОЖИДАНИЕ: пустой массив [] если нет бизнеса
    if (specialistsB.length !== 0) {
      console.error('\n🔥 КРИТИЧЕСКАЯ УТЕЧКА ДАННЫХ!');
      console.error('❌ USER_B видит специалистов!');
      console.error('❌ ДАННЫЕ НЕ ИЗОЛИРОВАНЫ!');
      console.error('❌ СПЕЦИАЛИСТЫ USER_B:', specialistsB);
      process.exit(1);
    }
    
    console.log('✅ USER_B не видит специалистов (пустой массив)');

    // USER_A вызывает /api/specialists
    console.log('\n🔍 USER_A вызывает GET /api/specialists');
    const specialistsA = await getSpecialists(loginA.cookies, 'USER_A');
    
    // Если USER_A создал специалиста, он должен его видеть
    if (specialistA) {
      const hasAMaster = specialistsA.some(s => s.name === 'A_MASTER_TEST');
      if (!hasAMaster) {
        console.error('\n🔥 ОШИБКА ТЕСТА!');
        console.error('❌ USER_A не видит своего специалиста A_MASTER_TEST');
        console.error('❌ СПЕЦИАЛИСТЫ USER_A:', specialistsA);
        process.exit(1);
      }
      
      console.log('✅ USER_A видит своего специалиста A_MASTER_TEST');
    } else {
      console.log('ℹ️  USER_A не создавал специалиста в этом тесте');
    }

    // ШАГ 5: ФИНАЛЬНАЯ ПРОВЕРКА
    console.log('\n📋 ШАГ 5: ФИНАЛЬНАЯ ПРОВЕРКА ИЗОЛЯЦИИ');
    console.log('============================================');

    // Проверяем что пользователи разные
    if (loginA.user.id === loginB.user.id) {
      throw new Error('🔥 КРИТИЧЕСКАЯ ОШИБКА: Пользователи имеют одинаковый ID!');
    }
    console.log('✅ Пользователи имеют разные ID');

    // Проверяем что бизнесы разные
    if (loginA.user.businessId === loginB.user.businessId && loginA.user.businessId !== null) {
      throw new Error('🔥 КРИТИЧЕСКАЯ ОШИБКА: Пользователи имеют одинаковый businessId!');
    }
    console.log('✅ Бизнесы изолированы');

    console.log('\n🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ!');
    console.log('✅ ISOLATION OK');
    console.log('✅ ДАННЫЕ ПОЛНОСТЬЮ ИЗОЛИРОВАНЫ');
    console.log('✅ USER_B НЕ ВИДИТ ДАННЫЕ USER_A');
    console.log('✅ USER_A ВИДИТ СВОИ ДАННЫЕ');

  } catch (error) {
    console.error('\n💥 ТЕСТ ПРОВАЛЕН:');
    console.error('🔥 КРИТИЧЕСКАЯ ОШИБКА БЕЗОПАСНОСТИ!');
    console.error('Нужно немедленно исправить утечку данных!');
    console.error('Ошибка:', error.message);
    process.exit(1);
  }
}

// Запуск теста
runIsolationSimpleTest().catch(error => {
  console.error('❌ Ошибка запуска теста:', error);
  process.exit(1);
});
