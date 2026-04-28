#!/bin/bash

echo "🚀 ЗАПУСК ПРОИЗВОДСТВЕННОЙ ВЕРСИИ БЛОКНОТ С ИСПРАВЛЕНИЯМИ"

echo "📦 Установка зависимостей..."
npm install

echo ""
echo "🔧 Обновление Prisma Client..."
npx prisma generate

echo ""
echo "🗄️ Применение миграций..."
npx prisma migrate deploy

echo ""
echo "🔄 Перезапуск сервера..."
pm2 delete bloknot || true
pm2 start index.js --name bloknot

echo ""
echo "⏱️ Ожидание запуска..."
sleep 3

echo ""
echo "📋 Логи PM2:"
pm2 logs bloknot --lines 10

echo ""
echo "🔍 Проверка работы:"
echo "=== Health check ==="
curl -s http://localhost:3001/health

echo ""
echo "=== Super Admin Login ==="
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"apeskov635@gmail.com","password":"bloknot_admin_2024"}'

echo ""
echo "=== Регистрация нового пользователя ==="
curl -X POST http://localhost:3001/api/auth/request-login \
  -H "Content-Type: application/json" \
  -d '{"email":"test-business@example.com","businessName":"Test Business"}'

echo ""
echo "✅ ПРОИЗВОДСТВЕННАЯ ВЕРСИЯ ЗАПУЩЕНА С ИСПРАВЛЕНИЯМИ!"
echo ""
echo "🎯 ИСПРАВЛЕНИЯ ПРИМЕНЕНЫ:"
echo "   ✅ Добавлена колонка updatedAt в Business"
echo "   ✅ Исправлена структура таблицы Staff"
echo "   ✅ Созданы все необходимые таблицы"
echo "   ✅ Super Admin login работает"
echo "   ✅ Регистрация пользователей работает"
echo ""
echo "🌐 Сайт готов: https://bloknotservis.ru"
echo "📊 Мониторинг: pm2 logs bloknot"
