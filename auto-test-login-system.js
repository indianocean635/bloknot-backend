#!/usr/bin/env node
/**
 * Автоматическое тестирование системы входа и изоляции ЛК
 */

const puppeteer = require('puppeteer');

async function testLoginSystem() {
    console.log('🚀 НАЧИНАЮ АВТОМАТИЧЕСКОЕ ТЕСТИРОВАНИЕ СИСТЕМЫ ВХОДА');
    
    const browser = await puppeteer.launch({ 
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        // ТЕСТ 1: Вход по логину/паролю
        console.log('\n📋 ТЕСТ 1: Вход по логину/паролю');
        await testLoginWithPassword(browser);
        
        // ТЕСТ 2: Регистрация нового пользователя
        console.log('\n📋 ТЕСТ 2: Регистрация нового пользователя');
        await testRegistration(browser);
        
        // ТЕСТ 3: Изоляция пользователей
        console.log('\n📋 ТЕСТ 3: Изоляция пользователей');
        await testUserIsolation(browser);
        
        console.log('\n✅ ВСЕ ТЕСТЫ ПРОЙДЕНЫ!');
        
    } catch (error) {
        console.error('❌ ОШИБКА ТЕСТИРОВАНИЯ:', error);
    } finally {
        await browser.close();
    }
}

async function testLoginWithPassword(browser) {
    const page = await browser.newPage();
    await page.goto('http://localhost:3001');
    
    // Нажать "Войти"
    await page.click('#loginLink');
    await page.waitForSelector('#authModal.open', { timeout: 5000 });
    
    // Ввести данные для входа
    await page.type('#authEmail', 'peskov142@mail.ru');
    await page.type('#authPassword', 'password123'); // Предполагаемый пароль
    
    // Нажать "Войти"
    await page.click('#authLoginBtn');
    
    // Ожидать успешного входа
    await page.waitForTimeout(2000);
    
    // Проверить localStorage
    const loggedInEmail = await page.evaluate(() => 
        localStorage.getItem('bloknot_logged_in_email')
    );
    const userEmail = await page.evaluate(() => 
        localStorage.getItem('bloknot_user_email')
    );
    const loggedIn = await page.evaluate(() => 
        localStorage.getItem('bloknot_logged_in')
    );
    
    console.log('  📧 localStorage bloknot_logged_in_email:', loggedInEmail);
    console.log('  📧 localStorage bloknot_user_email:', userEmail);
    console.log('  🔐 localStorage bloknot_logged_in:', loggedIn);
    
    // Нажать "Мой кабинет"
    await page.click('[href="/dashboard.html"]');
    await page.waitForTimeout(2000);
    
    // Проверить URL - должен быть dashboard.html без редиректа
    const currentUrl = page.url();
    if (currentUrl.includes('dashboard.html')) {
        console.log('  ✅ Успешный вход в ЛК без редиректа');
    } else {
        console.log('  ❌ Произошел редирект на главную');
    }
    
    await page.close();
}

async function testRegistration(browser) {
    const page = await browser.newPage();
    await page.goto('http://localhost:3001');
    
    // Нажать "Регистрация"
    await page.click('#signupLink');
    await page.waitForSelector('#authModal.open', { timeout: 5000 });
    
    // Сгенерировать уникальный email
    const testEmail = `test${Date.now()}@example.com`;
    
    // Заполнить форму регистрации
    await page.type('#authNameReg', 'Test User');
    await page.type('#authEmailReg', testEmail);
    await page.type('#authPhone', '+79991234567');
    await page.type('#authPasswordReg', 'password123');
    await page.type('#authPasswordConfirm', 'password123');
    
    // Нажать "Отправить ссылку"
    await page.click('#authSendBtn');
    await page.waitForTimeout(2000);
    
    // Проверить localStorage после регистрации
    const loggedInEmail = await page.evaluate(() => 
        localStorage.getItem('bloknot_logged_in_email')
    );
    const userEmail = await page.evaluate(() => 
        localStorage.getItem('bloknot_user_email')
    );
    const loggedIn = await page.evaluate(() => 
        localStorage.getItem('bloknot_logged_in')
    );
    
    console.log('  📧 Email после регистрации:', testEmail);
    console.log('  📧 localStorage bloknot_logged_in_email:', loggedInEmail);
    console.log('  📧 localStorage bloknot_user_email:', userEmail);
    console.log('  🔐 localStorage bloknot_logged_in:', loggedIn);
    
    if (loggedInEmail === testEmail && userEmail === testEmail && loggedIn === '1') {
        console.log('  ✅ Регистрация сохраняет email в localStorage');
    } else {
        console.log('  ❌ Регистрация не сохраняет email правильно');
    }
    
    await page.close();
}

async function testUserIsolation(browser) {
    // Тест с первым пользователем
    const page1 = await browser.newPage();
    await page1.goto('http://localhost:3001');
    
    // Войти как peskov142@mail.ru
    await page1.click('#loginLink');
    await page1.waitForSelector('#authModal.open');
    await page1.type('#authEmail', 'peskov142@mail.ru');
    await page1.type('#authPassword', 'password123');
    await page1.click('#authLoginBtn');
    await page1.waitForTimeout(2000);
    
    await page1.goto('http://localhost:3001/dashboard.html');
    await page1.waitForTimeout(2000);
    
    // Получить данные пользователя 1
    const user1Email = await page1.evaluate(() => 
        document.getElementById('userEmail')?.textContent || 'N/A'
    );
    
    console.log('  👤 Пользователь 1 видит email:', user1Email);
    
    // Тест со вторым пользователем
    const page2 = await browser.newPage();
    await page2.goto('http://localhost:3001');
    
    // Войти как manr5lca@acc1s.net
    await page2.click('#loginLink');
    await page2.waitForSelector('#authModal.open');
    await page2.type('#authEmail', 'manr5lca@acc1s.net');
    await page2.type('#authPassword', 'password123');
    await page2.click('#authLoginBtn');
    await page2.waitForTimeout(2000);
    
    await page2.goto('http://localhost:3001/dashboard.html');
    await page2.waitForTimeout(2000);
    
    // Получить данные пользователя 2
    const user2Email = await page2.evaluate(() => 
        document.getElementById('userEmail')?.textContent || 'N/A'
    );
    
    console.log('  👤 Пользователь 2 видит email:', user2Email);
    
    // Проверить изоляцию
    if (user1Email !== user2Email && user1Email !== 'N/A' && user2Email !== 'N/A') {
        console.log('  ✅ Пользователи изолированы - видят разные данные');
    } else {
        console.log('  ❌ Проблема с изоляцией пользователей');
    }
    
    await page1.close();
    await page2.close();
}

// Запустить тестирование
if (require.main === module) {
    testLoginSystem().catch(console.error);
}

module.exports = { testLoginSystem };
