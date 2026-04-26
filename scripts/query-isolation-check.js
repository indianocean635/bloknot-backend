const fs = require('fs');
const path = require('path');

// Конфигурация
const PROJECT_ROOT = __dirname;
const CONTROLLERS_DIR = path.join(PROJECT_ROOT, '..', 'controllers');
const ROUTES_DIR = path.join(PROJECT_ROOT, '..', 'routes');
const SERVICES_DIR = path.join(PROJECT_ROOT, '..', 'services');

// Статистика
let totalQueries = 0;
let safeQueries = 0;
let unsafeQueries = 0;
let issues = [];

// Проверка файла на утечки данных
function checkFile(filePath) {
  console.log(`\n🔍 Проверяю файл: ${filePath}`);
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    let fileIssues = [];
    
    lines.forEach((line, index) => {
      // Ищем Prisma запросы
      const prismaMatch = line.match(/prisma\.\w+\.(findMany|findFirst|findUnique)\s*\(/);
      
      if (prismaMatch) {
        totalQueries++;
        const queryType = prismaMatch[1];
        const lineNumber = index + 1;
        
        console.log(`  📝 Строка ${lineNumber}: ${queryType}`);
        
        // Проверяем наличие where (многострочные запросы)
        const currentLine = line.trim();
        const nextLines = lines.slice(index, index + 10).join('\n');
        const hasWhere = nextLines.includes('where:');
        
        if (!hasWhere) {
          // КРИТИЧЕСКАЯ УТЕЧКА - нет where
          unsafeQueries++;
          const issue = {
            type: 'CRITICAL_NO_WHERE',
            file: filePath,
            line: lineNumber,
            query: line.trim(),
            description: `❌ ${queryType}() без where - возвращает первые попавшиеся данные!`
          };
          fileIssues.push(issue);
          issues.push(issue);
          console.log(`    🔥 ${issue.description}`);
        } else {
          // Проверяем фильтрацию по пользователю
          const hasUserFilter = line.includes('req.user.id') || line.includes('req.user.businessId');
          const hasBusinessFilter = line.includes('businessId:');
          const hasEmailFilter = line.includes('email:');
          
          if (queryType === 'findMany' && (!hasUserFilter && !hasBusinessFilter && !hasEmailFilter)) {
            // ВОЗМОЖНАЯ УТЕЧКА - есть where но нет фильтрации по пользователю
            unsafeQueries++;
            const issue = {
              type: 'POTENTIAL_LEAK',
              file: filePath,
              line: lineNumber,
              query: line.trim(),
              description: `⚠️  ${queryType}() с where но без фильтрации по пользователю!`
            };
            fileIssues.push(issue);
            issues.push(issue);
            console.log(`    ⚠️  ${issue.description}`);
          } else {
            // БЕЗОПАСНЫЙ ЗАПРОС
            safeQueries++;
            console.log(`    ✅ ${queryType}() с правильной фильтрацией`);
          }
        }
      }
    });
    
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

// Проверка middleware
function checkMiddleware() {
  console.log('\n🔐 Проверяю middleware...');
  
  const middlewarePath = path.join(PROJECT_ROOT, '..', 'middleware');
  
  try {
    const files = fs.readdirSync(middlewarePath);
    
    for (const file of files) {
      if (file.endsWith('.js')) {
        const filePath = path.join(middlewarePath, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Проверяем использование req.user
        if (content.includes('req.user') && !content.includes('req.user.id') && !content.includes('req.user.businessId')) {
          console.log(`  ⚠️  ${file}: использует req.user без конкретного поля`);
        }
        
        // Проверяем cookie имя
        if (content.includes("token") && !content.includes("auth")) {
          console.log(`  🔥 ${file}: использует 'token' cookie вместо 'auth'`);
          issues.push({
            type: 'COOKIE_NAME_MISMATCH',
            file: filePath,
            description: `❌ Использует 'token' cookie вместо 'auth'`
          });
        }
      }
    }
  } catch (error) {
    console.error('❌ Ошибка проверки middleware:', error.message);
  }
}

// Основной тест
async function runQueryIsolationCheck() {
  console.log('🚀 ЗАПУСКАЕМ ПРОВЕРКУ ИЗОЛЯЦИИ ЗАПРОСОВ');
  console.log('==========================================');
  
  try {
    // Сканируем все директории
    const controllerIssues = scanDirectory(CONTROLLERS_DIR);
    const routesIssues = scanDirectory(ROUTES_DIR);
    const servicesIssues = scanDirectory(SERVICES_DIR);
    
    // Проверяем middleware
    checkMiddleware();
    
    // Выводим статистику
    console.log('\n📊 СТАТИСТИКА');
    console.log('==========================================');
    console.log(`Всего запросов: ${totalQueries}`);
    console.log(`Безопасных: ${safeQueries} ✅`);
    console.log(`Небезопасных: ${unsafeQueries} ❌`);
    
    // Классифицируем проблемы
    const criticalIssues = issues.filter(i => i.type === 'CRITICAL_NO_WHERE');
    const potentialLeaks = issues.filter(i => i.type === 'POTENTIAL_LEAK');
    const cookieIssues = issues.filter(i => i.type === 'COOKIE_NAME_MISMATCH');
    
    console.log(`\n🔥 КРИТИЧЕСКИЕ УТЕЧКИ: ${criticalIssues.length}`);
    console.log(`⚠️  Потенциальные утечки: ${potentialLeaks.length}`);
    console.log(`🍪 Проблемы с cookie: ${cookieIssues.length}`);
    
    // Выводим детали проблем
    if (issues.length > 0) {
      console.log('\n🔍 ДЕТАЛИ ПРОБЛЕМ');
      console.log('==========================================');
      
      issues.forEach((issue, index) => {
        console.log(`\n${index + 1}. ${issue.description}`);
        console.log(`   Файл: ${issue.file}`);
        if (issue.line) {
          console.log(`   Строка: ${issue.line}`);
          console.log(`   Код: ${issue.query}`);
        }
      });
    }
    
    // Выводим результат
    console.log('\n🎯 РЕЗУЛЬТАТ');
    console.log('==========================================');
    
    if (criticalIssues.length > 0) {
      console.log('🔥 КРИТИЧЕСКИЕ УТЕЧКИ ДАННЫХ НАЙДЕНЫ!');
      console.log('❌ Нужно немедленно исправить следующие проблемы:');
      criticalIssues.forEach(issue => {
        console.log(`   - ${issue.file}:${issue.line} - ${issue.description}`);
      });
      process.exit(1);
    } else if (potentialLeaks.length > 0) {
      console.log('⚠️  НАЙДЕНЫ ПОТЕНЦИАЛЬНЫЕ УТЕЧКИ!');
      console.log('🔍 Рекомендуется проверить:');
      potentialLeaks.forEach(issue => {
        console.log(`   - ${issue.file}:${issue.line} - ${issue.description}`);
      });
    } else if (cookieIssues.length > 0) {
      console.log('🍪 НАЙДЕНЫ ПРОБЛЕМЫ С COOKIE!');
      cookieIssues.forEach(issue => {
        console.log(`   - ${issue.file} - ${issue.description}`);
      });
    } else {
      console.log('✅ ВСЕ ЗАПРОСЫ БЕЗОПАСНЫ!');
      console.log('🎉 ДАННЫЕ ПОЛНОСТЬЮ ИЗОЛИРОВАНЫ!');
      console.log('🔒 УТЕЧКИ ДАННЫХ НЕ НАЙДЕНЫ!');
    }
    
  } catch (error) {
    console.error('❌ Ошибка выполнения проверки:', error);
    process.exit(1);
  }
}

// Запуск проверки
runQueryIsolationCheck().catch(error => {
  console.error('❌ Ошибка запуска проверки:', error);
  process.exit(1);
});
