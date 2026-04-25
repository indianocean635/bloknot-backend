#!/bin/bash
# Простое тестирование системы входа через curl

echo "🚀 НАЧИНАЮ ТЕСТИРОВАНИЕ СИСТЕМЫ ВХОДА"

# ТЕСТ 1: Проверка работы сервера
echo -e "\n📋 ТЕСТ 1: Проверка работы сервера"
response=$(curl -s http://localhost:3001/api/version)
if [[ $response == *"Bloknot"* ]]; then
    echo "✅ Сервер отвечает"
else
    echo "❌ Сервер не отвечает"
    exit 1
fi

# ТЕСТ 2: Проверка входа по API
echo -e "\n📋 ТЕСТ 2: Проверка входа по API"
login_response=$(curl -s -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"peskov142@mail.ru","password":"password123"}')

if [[ $login_response == *"success"* ]]; then
    echo "✅ Успешный вход по API"
    echo "Ответ: $login_response"
else
    echo "❌ Ошибка входа по API"
    echo "Ответ: $login_response"
fi

# ТЕСТ 3: Проверка /api/auth/me
echo -e "\n📋 ТЕСТ 3: Проверка /api/auth/me"
me_response=$(curl -s -H "x-user-email: peskov142@mail.ru" http://localhost:3001/api/auth/me)

if [[ $me_response == *"peskov142@mail.ru"* ]]; then
    echo "✅ /api/auth/me возвращает данные пользователя"
    echo "Email найден в ответе"
else
    echo "❌ /api/auth/me не возвращает данные пользователя"
    echo "Ответ: $me_response"
fi

# ТЕСТ 4: Проверка бизнес slug
echo -e "\n📋 ТЕСТ 4: Проверка бизнес slug"
slug_response=$(curl -s -H "x-user-email: peskov142@mail.ru" http://localhost:3001/api/business/slug)

if [[ $slug_response == *"name"* ]]; then
    echo "✅ Бизнес slug работает"
    echo "Ответ содержит данные бизнеса"
else
    echo "❌ Бизнес slug не работает"
    echo "Ответ: $slug_response"
fi

# ТЕСТ 5: Проверка второго пользователя
echo -e "\n📋 ТЕСТ 5: Проверка второго пользователя"
login2_response=$(curl -s -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"manr5lca@acc1s.net","password":"password123"}')

if [[ $login2_response == *"success"* ]]; then
    echo "✅ Второй пользователь может войти"
else
    echo "❌ Второй пользователь не может войти"
    echo "Ответ: $login2_response"
fi

# ТЕСТ 6: Проверка изоляции (разные бизнесы)
echo -e "\n📋 ТЕСТ 6: Проверка изоляции пользователей"
slug1=$(curl -s -H "x-user-email: peskov142@mail.ru" http://localhost:3001/api/business/slug | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
slug2=$(curl -s -H "x-user-email: manr5lca@acc1s.net" http://localhost:3001/api/business/slug | grep -o '"name":"[^"]*"' | cut -d'"' -f4)

echo "Бизнес пользователя 1: $slug1"
echo "Бизнес пользователя 2: $slug2"

if [[ "$slug1" != "$slug2" && "$slug1" != "" && "$slug2" != "" ]]; then
    echo "✅ Пользователи имеют разные бизнесы (изолированы)"
else
    echo "❌ Проблема с изоляцией пользователей"
fi

echo -e "\n🎉 ТЕСТИРОВАНИЕ ЗАВЕРШЕНО!"
echo "Теперь проверьте в браузере:"
echo "1. Вход по логину/паролю"
echo "2. Сохранение email в localStorage"
echo "3. Доступ к ЛК без редиректа"
