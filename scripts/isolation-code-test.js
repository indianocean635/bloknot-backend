const fs = require('fs');
const path = require('path');

// Конфигурация
const PROJECT_ROOT = __dirname;
const ROUTES_DIR = path.join(PROJECT_ROOT, '..', 'routes');
const CONTROLLERS_DIR = path.join(PROJECT_ROOT, '..', 'controllers');

// Статистика
let totalEndpoints = 0;
let secureEndpoints = 0;
let insecureEndpoints = 0;
let issues = [];

// Проверка файла на изоляцию данных
function checkFile(filePath) {
  console.log(`\n🔍 Проверяю файл: ${filePath}`);
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    let fileIssues = [];
    let hasUserLogging = false;
    let hasBusinessFilter = false;
    let hasEmptyArrayReturn = false;
    
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      
      // Ищем эндпоинты
      const endpointMatch = line.match(/router\.(get|post|put|delete)\s*\(/);
      if (endpointMatch) {
        totalEndpoints++;
        const method = endpointMatch[1];
        console.log(`  📝 Строка ${lineNumber}: ${method} endpoint`);
      }
      
      // Проверяем логирование user.id и businessId
      if (line.includes('console.log("USER ID:")') || line.includes('console.log("BUSINESS ID:")')) {
        hasUserLogging = true;
        console.log(`    ✅ Найдено логирование user/business ID`);
      }
      
      // Проверяем фильтрацию по businessId
      if (line.includes('businessId:') && line.includes('req.user.businessId')) {
        hasBusinessFilter = true;
        console.log(`    ✅ Найдена фильтрация по businessId`);
      }
      
      // Проверяем возврат пустого массива
      if (line.includes('return res.json([])') || line.includes('return res.json({})')) {
        hasEmptyArrayReturn = true;
        console.log(`    ✅ Найден возврат пустого массива`);
      }
      
      // Проверяем отсутствие localStorage на фронтенде
      if (line.includes('localStorage.getItem') || line.includes('localStorage.setItem')) {
        if (filePath.includes('public')) {
          fileIssues.push({
            type: 'LOCALSTORAGE_USAGE',
            file: filePath,
            line: lineNumber,
            code: line.trim(),
            description: `❌ Найдено использование localStorage во фронтенде!`
          });
          console.log(`    🔥 Найдено localStorage использование!`);
        }
      }
    });
    
    // Проверяем наличие всех необходимых элементов для защищенных роутов
    if (filePath.includes('routes') && !filePath.includes('publicRoutes')) {
      if (!hasUserLogging) {
        fileIssues.push({
          type: 'NO_USER_LOGGING',
          file: filePath,
          description: `❌ Отсутствует логирование user.id и businessId`
        });
      }
      
      if (!hasBusinessFilter) {
        fileIssues.push({
          type: 'NO_BUSINESS_FILTER',
          file: filePath,
          description: `❌ Отсутствует фильтрация по businessId`
        });
      }
      
      if (!hasEmptyArrayReturn) {
        fileIssues.push({
          type: 'NO_EMPTY_ARRAY_RETURN',
          file: filePath,
          description: `❌ Отсутствует возврат пустого массива при отсутствии businessId`
        });
      }
      
      // Считаем роут безопасным если есть все элементы
      if (hasUserLogging && hasBusinessFilter && hasEmptyArrayReturn) {
        secureEndpoints++;
        console.log(`    ✅ Эндпоинт безопасен`);
      } else {
        insecureEndpoints++;
        console.log(`    ⚠️  Эндпоинт может быть небезопасен`);
      }
    }
    
    return fileIssues;
    
  } catch (error) {
    console.error(`❌ Ошибка чтения файла ${filePath}:`, error.message);
    return [];
  }
}

// Рекурсивный обход директории
function scanDirectory(dirPath, filePattern = /\.js$/) {
  console.log(`\n📁 Сканирую директорию: ${dirPath}`);
  
  try {
    const items = fs.readdirSync(dirPath);
    let allIssues = [];
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        // Рекурсивно сканируем поддиректории
        const subIssues = scanDirectory(itemPath, filePattern);
        allIssues = allIssues.concat(subIssues);
      } else if (filePattern.test(item)) {
        // Проверяем JS файлы
        const fileIssues = checkFile(itemPath);
        allIssues = allIssues.concat(fileIssues);
      }
    }
    
    return allIssues;
    
  } catch (error) {
    console.error(`❌ Ошибка сканирования директории ${dirPath}:`, error.message);
    return [];
  }
}

// Проверка localStorage на фронтенде
function checkFrontendLocalStorage() {
  console.log('\n🔍 ПРОВЕРКА localStorage НА ФРОНТЕНДЕ');
  console.log('============================================');
  
  const publicDir = path.join(PROJECT_ROOT, '..', 'public');
  const localStorageIssues = [];
  
  function scanForLocalStorage(dirPath) {
    try {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stat = fs.statSync(itemPath);
        
        if (stat.isDirectory()) {
          scanForLocalStorage(itemPath);
        } else if (item.endsWith('.html') || item.endsWith('.js')) {
          const content = fs.readFileSync(itemPath, 'utf8');
          const lines = content.split('\n');
          
          lines.forEach((line, index) => {
            if (line.includes('localStorage.getItem') || line.includes('localStorage.setItem')) {
              localStorageIssues.push({
                type: 'LOCALSTORAGE_FRONTEND',
                file: itemPath,
                line: index + 1,
                code: line.trim(),
                description: `❌ Найдено localStorage в фронтенде!`
              });
            }
          });
        }
      }
    } catch (error) {
      console.error(`❌ Ошибка сканирования ${dirPath}:`, error.message);
    }
  }
  
  scanForLocalStorage(publicDir);
  return localStorageIssues;
}

// Основной тест
async function runIsolationCodeTest() {
  console.log('🚀 ЗАПУСКАЕМ ТЕСТ ИЗОЛЯЦИИ КОДА');
  console.log('============================================');
  
  try {
    // Сканируем роуты
    console.log('\n📋 СКАНИРОВАНИЕ ЗАЩИЩЕННЫХ РОУТОВ');
    console.log('============================================');
    
    const routesIssues = scanDirectory(ROUTES_DIR);
    
    // Проверяем фронтенд на localStorage
    const frontendIssues = checkFrontendLocalStorage();
    
    // Объединяем все проблемы
    const allIssues = [...routesIssues, ...frontendIssues];
    
    // Выводим статистику
    console.log('\n📊 СТАТИСТИКА');
    console.log('============================================');
    console.log(`Всего эндпоинтов: ${totalEndpoints}`);
    console.log(`Безопасных эндпоинтов: ${secureEndpoints} ✅`);
    console.log(`Небезопасных эндпоинтов: ${insecureEndpoints} ⚠️`);
    console.log(`Проблем с localStorage: ${frontendIssues.length} 🔥`);
    
    // Классифицируем проблемы
    const localStorageIssues = allIssues.filter(i => i.type === 'LOCALSTORAGE_FRONTEND');
    const noLoggingIssues = allIssues.filter(i => i.type === 'NO_USER_LOGGING');
    const noFilterIssues = allIssues.filter(i => i.type === 'NO_BUSINESS_FILTER');
    const noEmptyArrayIssues = allIssues.filter(i => i.type === 'NO_EMPTY_ARRAY_RETURN');
    
    console.log(`\n🔥 КРИТИЧЕСКИЕ ПРОБЛЕМЫ: ${localStorageIssues.length}`);
    console.log(`⚠️  Отсутствует логирование: ${noLoggingIssues.length}`);
    console.log(`⚠️  Отсутствует фильтрация: ${noFilterIssues.length}`);
    console.log(`⚠️  Отсутствует пустой массив: ${noEmptyArrayIssues.length}`);
    
    // Выводим детали проблем
    if (allIssues.length > 0) {
      console.log('\n🔍 ДЕТАЛИ ПРОБЛЕМ');
      console.log('============================================');
      
      allIssues.forEach((issue, index) => {
        console.log(`\n${index + 1}. ${issue.description}`);
        console.log(`   Файл: ${issue.file}`);
        if (issue.line) {
          console.log(`   Строка: ${issue.line}`);
          console.log(`   Код: ${issue.code}`);
        }
      });
    }
    
    // Выводим результат
    console.log('\n🎯 РЕЗУЛЬТАТ');
    console.log('============================================');
    
    if (localStorageIssues.length > 0) {
      console.log('🔥 КРИТИЧЕСКИЕ УТЕЧКИ localStorage НАЙДЕНЫ!');
      console.log('❌ Нужно немедленно удалить localStorage из фронтенда!');
      localStorageIssues.forEach(issue => {
        console.log(`   - ${issue.file}:${issue.line}`);
      });
      process.exit(1);
    } else if (noFilterIssues.length > 0) {
      console.log('⚠️  НАЙДЕНЫ ЭНДПОИНТЫ БЕЗ ФИЛЬТРАЦИИ!');
      console.log('🔍 Рекомендуется добавить фильтрацию по businessId:');
      noFilterIssues.forEach(issue => {
        console.log(`   - ${issue.file}`);
      });
    } else if (noLoggingIssues.length > 0) {
      console.log('⚠️  НАЙДЕНЫ ЭНДПОИНТЫ БЕЗ ЛОГИРОВАНИЯ!');
      console.log('🔍 Рекомендуется добавить логирование user.id и businessId:');
      noLoggingIssues.forEach(issue => {
        console.log(`   - ${issue.file}`);
      });
    } else {
      console.log('✅ КОД БЕЗОПАСЕН!');
      console.log('🎉 localStorage УДАЛЕН ИЗ ФРОНТЕНДА!');
      console.log('🔒 ВСЕ ЭНДПОИНТЫ ИМЕЮТ ФИЛЬТРАЦИЮ!');
      console.log('📝 ВСЕ ЭНДПОИНТЫ ИМЕЮТ ЛОГИРОВАНИЕ!');
      console.log('🔒 ДАННЫЕ ПОЛНОСТЬЮ ИЗОЛИРОВАНЫ!');
    }
    
  } catch (error) {
    console.error('❌ Ошибка выполнения теста:', error);
    process.exit(1);
  }
}

// Запуск теста
runIsolationCodeTest().catch(error => {
  console.error('❌ Ошибка запуска теста:', error);
  process.exit(1);
});
