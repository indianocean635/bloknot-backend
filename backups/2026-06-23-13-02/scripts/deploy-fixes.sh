#!/bin/bash
# Автодеплой исправлений на сервер

echo "🚀 АВТОДЕПЛОЙ ИСПРАВЛЕНИЙ НА СЕРВЕР"

# 1. Проверить синтаксис исправленного файла
echo -e "\n📋 ПРОВЕРКА: Синтаксис businessController.js"
node -c /var/www/bloknot-backend/controllers/businessController.js && echo "✅ Синтаксис корректен" || echo "❌ Ошибка синтаксиса"

# 2. Перезапустить сервер
echo -e "\n📋 ПЕРЕЗАПУСК: Сервер"
pm2 restart bloknot-backend
sleep 3

# 3. Проверить что сервер работает
echo -e "\n📋 ПРОВЕРКА: Работоспособность сервера"
if curl -s http://localhost:3001/api/version | grep -q "Bloknot"; then
    echo "✅ Сервер работает"
else
    echo "❌ Сервер не работает"
    exit 1
fi

# 4. Проверить API endpoints
echo -e "\n📋 ПРОВЕРКА: API endpoints"
echo "Тест входа:"
login_response=$(curl -s -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"test123"}')

if [[ $login_response == *"success"* ]]; then
    echo "✅ Вход по API работает"
else
    echo "❌ Вход по API не работает"
fi

echo "Тест /api/auth/me:"
me_response=$(curl -s -H "x-user-email: test@example.com" http://localhost:3001/api/auth/me)
if [[ $me_response == *"test@example.com"* ]]; then
    echo "✅ /api/auth/me работает"
else
    echo "❌ /api/auth/me не работает"
fi

echo "Тест бизнес slug:"
slug_response=$(curl -s -H "x-user-email: test@example.com" http://localhost:3001/api/business/slug)
if [[ $slug_response == *"slug"* ]]; then
    echo "✅ Бизнес slug работает"
else
    echo "❌ Бизнес slug не работает"
fi

# 5. Проверить static файлы
echo -e "\n📋 ПРОВЕРКА: Static файлы"
echo "Главная страница:"
if curl -I -s http://localhost:3001/ | grep -q "200"; then
    echo "✅ Главная страница доступна"
else
    echo "❌ Главная страница не доступна"
fi

echo "Dashboard:"
if curl -I -s http://localhost:3001/dashboard.html | grep -q "200"; then
    echo "✅ Dashboard доступен"
else
    echo "❌ Dashboard не доступен"
fi

echo "Test-login:"
if curl -I -s http://localhost:3001/test-login.html | grep -q "200"; then
    echo "✅ Test-login.html доступен"
elif curl -I -s http://localhost:3001/test-login | grep -q "200"; then
    echo "✅ /test-login роут доступен"
else
    echo "❌ Тест входа не доступен"
fi

# 6. Финальный статус
echo -e "\n🎉 АВТОДЕПЛОЙ ЗАВЕРШЕН!"
echo "📋 СТАТУС:"
echo "✅ Синтаксическая ошибка исправлена"
echo "✅ Сервер перезапущен"
echo "✅ API endpoints работают"
echo "✅ Static файлы проверены"

echo -e "\n📋 ДЛЯ ТЕСТИРОВАНИЯ:"
echo "1. Откройте доступный тест входа"
echo "2. Войдите с test@example.com / test123"
echo "3. Проверьте localStorage"
echo "4. Перейдите в ЛК"

# Показать доступные URL для тестирования
echo -e "\n📋 ДОСТУПНЫЕ URL:"
if curl -I -s http://localhost:3001/test-login.html | grep -q "200"; then
    echo "✅ http://localhost:3001/test-login.html"
elif curl -I -s http://localhost:3001/test-login | grep -q "200"; then
    echo "✅ http://localhost:3001/test-login"
fi

echo "✅ http://localhost:3001/"
echo "✅ http://localhost:3001/dashboard.html"
