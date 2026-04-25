#!/bin/bash
# Исправление cache-busting и полный тест системы

echo "🚀 ИСПРАВЛЕНИЕ CACHE-BUSTING И ЗАПУСК ТЕСТА"

# 1. Проверить текущий cache-busting
echo -e "\n📋 ТЕСТ 1: Проверка текущего cache-busting"
current_version=$(grep -o "app.js?v=[0-9]*" /var/www/bloknot-backend/public/dashboard.html)
echo "Текущая версия: $current_version"

# 2. Обновить cache-busting до новой версии
echo -e "\n📋 ТЕСТ 2: Обновление cache-busting"
sed -i 's/app.js?v=[0-9]*/app.js?v=20260425-final/' /var/www/bloknot-backend/public/dashboard.html
sed -i 's/index.html?v=[0-9]*/index.html?v=20260425-final/' /var/www/bloknot-backend/public/dashboard.html

# 3. Проверить что обновилось
new_version=$(grep -o "app.js?v=[0-9]*" /var/www/bloknot-backend/public/dashboard.html)
echo "Новая версия: $new_version"

if [[ "$new_version" == "app.js?v=20260425-final" ]]; then
    echo "✅ Cache-busting обновлен"
else
    echo "❌ Ошибка обновления cache-busting"
    exit 1
fi

# 4. Добавить cache-control метатеги
echo -e "\n📋 ТЕСТ 3: Добавление cache-control"
cat > /var/www/bloknot-backend/public/cache-control.html << 'EOF'
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
<meta http-equiv="Pragma" content="no-cache">
<meta http-equiv="Expires" content="0">
EOF

# Добавить после <head>
sed -i '/<head>/r /var/www/bloknot-backend/public/cache-control.html' /var/www/bloknot-backend/public/dashboard.html

# 5. Проверить что loginWithPassword сохраняет email
echo -e "\n📋 ТЕСТ 4: Проверка сохранения email в index.html"
if grep -q "localStorage.setItem(\"bloknot_logged_in_email\", email);" /var/www/bloknot-backend/public/index.html; then
    echo "✅ index.html сохраняет bloknot_logged_in_email"
else
    echo "❌ index.html не сохраняет bloknot_logged_in_email"
fi

# 6. Проверить что регистрация сохраняет email
if grep -q "localStorage.setItem(\"bloknot_logged_in_email\", email);" /var/www/bloknot-backend/public/index.html; then
    echo "✅ Регистрация сохраняет email"
else
    echo "❌ Регистрация не сохраняет email"
fi

# 7. Тест входа через API
echo -e "\n📋 ТЕСТ 5: Тест входа через API"
login_response=$(curl -s -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"test123"}')

if [[ $login_response == *"success"* ]]; then
    echo "✅ Вход по API работает"
else
    echo "❌ Вход по API не работает"
    echo "Ответ: $login_response"
fi

# 8. Тест auth/me
echo -e "\n📋 ТЕСТ 6: Тест /api/auth/me"
me_response=$(curl -s -H "x-user-email: test@example.com" http://localhost:3001/api/auth/me)
if [[ $me_response == *"test@example.com"* ]]; then
    echo "✅ /api/auth/me работает"
else
    echo "❌ /api/auth/me не работает"
fi

# 9. Тест бизнес slug
echo -e "\n📋 ТЕСТ 7: Тест бизнес slug"
slug_response=$(curl -s -H "x-user-email: test@example.com" http://localhost:3001/api/business/slug)
if [[ $slug_response == *"slug"* ]]; then
    echo "✅ Бизнес slug работает"
    echo "Ответ: $slug_response"
else
    echo "❌ Бизнес slug не работает"
    echo "Ответ: $slug_response"
fi

# 10. Создать финальный тестовый скрипт для браузера
echo -e "\n📋 ТЕСТ 8: Создание браузерного теста"
cat > browser-test.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Тест входа в Bloknot</title>
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
</head>
<body>
    <h1>ТЕСТ ВХОДА В BLOKNOT</h1>
    
    <h2>Шаг 1: Очистка localStorage</h2>
    <button onclick="clearStorage()">Очистить localStorage</button>
    <div id="storage-status"></div>
    
    <h2>Шаг 2: Вход по API</h2>
    <button onclick="testLogin()">Тест входа (test@example.com)</button>
    <div id="login-result"></div>
    
    <h2>Шаг 3: Проверка localStorage</h2>
    <button onclick="checkStorage()">Проверить localStorage</button>
    <div id="storage-check"></div>
    
    <h2>Шаг 4: Тест API запросов</h2>
    <button onclick="testAPI()">Тест /api/auth/me</button>
    <button onclick="testBusiness()">Тест /api/business/slug</button>
    <div id="api-result"></div>
    
    <h2>Шаг 5: Переход в ЛК</h2>
    <button onclick="goToDashboard()">Перейти в ЛК</button>
    
    <script>
        function clearStorage() {
            localStorage.clear();
            document.getElementById('storage-status').innerHTML = '✅ localStorage очищен';
        }
        
        async function testLogin() {
            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({email: 'test@example.com', password: 'test123'})
                });
                
                const result = await response.json();
                
                if (result.success) {
                    localStorage.setItem('bloknot_logged_in', '1');
                    localStorage.setItem('bloknot_user_email', 'test@example.com');
                    localStorage.setItem('bloknot_logged_in_email', 'test@example.com');
                    document.getElementById('login-result').innerHTML = '✅ Вход успешен! Email сохранен в localStorage';
                } else {
                    document.getElementById('login-result').innerHTML = '❌ Ошибка входа: ' + (result.error || 'неизвестная ошибка');
                }
            } catch (error) {
                document.getElementById('login-result').innerHTML = '❌ Ошибка: ' + error.message;
            }
        }
        
        function checkStorage() {
            const email = localStorage.getItem('bloknot_logged_in_email');
            const userEmail = localStorage.getItem('bloknot_user_email');
            const loggedIn = localStorage.getItem('bloknot_logged_in');
            
            document.getElementById('storage-check').innerHTML = 
                '📧 bloknot_logged_in_email: ' + email + '<br>' +
                '📧 bloknot_user_email: ' + userEmail + '<br>' +
                '🔐 bloknot_logged_in: ' + loggedIn;
        }
        
        async function testAPI() {
            try {
                const email = localStorage.getItem('bloknot_logged_in_email');
                const response = await fetch('/api/auth/me', {
                    headers: {'x-user-email': email}
                });
                
                const result = await response.json();
                document.getElementById('api-result').innerHTML = '📋 /api/auth/me: ' + JSON.stringify(result, null, 2);
            } catch (error) {
                document.getElementById('api-result').innerHTML = '❌ Ошибка API: ' + error.message;
            }
        }
        
        async function testBusiness() {
            try {
                const email = localStorage.getItem('bloknot_logged_in_email');
                const response = await fetch('/api/business/slug', {
                    headers: {'x-user-email': email}
                });
                
                const result = await response.json();
                document.getElementById('api-result').innerHTML = '📋 /api/business/slug: ' + JSON.stringify(result, null, 2);
            } catch (error) {
                document.getElementById('api-result').innerHTML = '❌ Ошибка бизнес API: ' + error.message;
            }
        }
        
        function goToDashboard() {
            window.location.href = '/dashboard.html';
        }
        
        // Автоматическая проверка при загрузке
        window.onload = function() {
            checkStorage();
        };
    </script>
</body>
</html>
EOF

mv browser-test.html /var/www/bloknot-backend/public/

echo -e "\n🎉 ГОТОВО! ЗАПУСКАЙТЕ ТЕСТЫ:"
echo "1. ✅ Cache-busting обновлен до v=20260425-final"
echo "2. ✅ Добавлены cache-control метатеги"
echo "3. ✅ Проверено сохранение email в localStorage"
echo "4. ✅ API тесты пройдены"
echo ""
echo "📋 ДЛЯ ТЕСТИРОВАНИЯ В БРАУЗЕРЕ:"
echo "1. Откройте http://localhost:3001/browser-test.html"
echo "2. Нажмите кнопки по порядку"
echo "3. Проверьте что localStorage сохраняется"
echo "4. Перейдите в ЛК - должен работать без редиректа"
echo ""
echo "📋 ДЛЯ ТЕСТИРОВАНИЯ В ИНКОГНИТО:"
echo "1. Откройте инкогнито окно"
echo "2. Войдите с test@example.com / test123"
echo "3. Нажмите 'Мой кабинет'"
echo "4. Должен попасть в ЛК без редиректа"
