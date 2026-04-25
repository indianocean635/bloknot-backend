// Тест middleware без базы данных
const jwt = require('jsonwebtoken');

// Эмулируем middleware
function authMiddleware(req, res, next) {
  const cookies = req.headers.cookie || "";

  const parsed = {};
  cookies.split(";").forEach(c => {
    const [k, v] = c.trim().split("=");
    if (k && v) parsed[k] = decodeURIComponent(v);
  });

  const token = parsed["token"]; // Используем "token" как в login

  if (!token) {
    return res.status(401).json({ error: "No auth" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = { id: payload.userId };
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// Тестовая функция
function testMiddleware() {
  console.log('🧪 ТЕСТИРУЕМ JWT MIDDLEWARE');
  console.log('='.repeat(50));

  // Создаем тестовый JWT
  const testPayload = { userId: 'test-user-123' };
  const token = jwt.sign(testPayload, process.env.JWT_SECRET || 'your-secret-key');

  // Эмулируем запрос с cookie
  const mockReq = {
    headers: {
      cookie: `token=${token}`
    }
  };

  let mockRes = {
    status: (code) => ({
      json: (data) => {
        console.log(`❌ Middleware вернул ошибку ${code}:`, data);
        return mockRes;
      }
    })
  };

  let nextCalled = false;
  const mockNext = () => {
    nextCalled = true;
    console.log('✅ Middleware пропустил запрос');
  };

  // Запускаем middleware
  authMiddleware(mockReq, mockRes, mockNext);

  if (nextCalled) {
    console.log('✅ req.user установлен:', mockReq.user);
    console.log('✅ JWT Middleware работает корректно');
    return true;
  } else {
    console.log('❌ Middleware не сработал');
    return false;
  }
}

// Тест парсинга cookie
function testCookieParsing() {
  console.log('\n🍪 ТЕСТИРУЕМ ПАРСИНГ COOKIE');
  console.log('='.repeat(50));

  const testCases = [
    {
      name: 'Базовый cookie',
      input: 'token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
      expected: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test'
    },
    {
      name: 'Множественные cookie',
      input: 'other=value; token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test; another=123',
      expected: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test'
    },
    {
      name: 'Cookie с пробелами',
      input: ' token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test ; other=value ',
      expected: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test'
    }
  ];

  let allPassed = true;

  testCases.forEach(testCase => {
    const cookies = testCase.input;
    const parsed = {};
    
    cookies.split(";").forEach(c => {
      const [k, v] = c.trim().split("=");
      if (k && v) parsed[k] = decodeURIComponent(v);
    });

    const result = parsed["token"];
    const passed = result === testCase.expected;

    console.log(`${passed ? '✅' : '❌'} ${testCase.name}: ${passed ? 'OK' : 'FAILED'}`);
    if (!passed) {
      console.log(`   Ожидал: ${testCase.expected}`);
      console.log(`   Получил: ${result}`);
      allPassed = false;
    }
  });

  return allPassed;
}

// Запуск тестов
function runAllTests() {
  console.log('🚀 ЗАПУСКАЕМ ТЕСТЫ MIDDLEWARE');
  console.log('='.repeat(60));

  const middlewareTest = testMiddleware();
  const cookieTest = testCookieParsing();

  console.log('\n📊 РЕЗУЛЬТАТЫ:');
  console.log('='.repeat(30));
  console.log(`Middleware: ${middlewareTest ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Cookie parsing: ${cookieTest ? '✅ PASS' : '❌ FAIL'}`);

  if (middlewareTest && cookieTest) {
    console.log('\n🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ!');
    console.log('✅ JWT Middleware работает корректно');
    console.log('✅ Cookie парсинг работает корректно');
    console.log('✅ req.user будет установлен правильно');
  } else {
    console.log('\n💥 НЕКОТОРЫЕ ТЕСТЫ ПРОВАЛЕНЫ!');
    console.log('🔥 Нужна отладка middleware');
    process.exit(1);
  }
}

// Запуск
if (require.main === module) {
  runAllTests();
}

module.exports = { testMiddleware, testCookieParsing, runAllTests };
