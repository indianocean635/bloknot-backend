@echo off
echo 🚀 ЗАПУСК БЛОКНОТ БЕЗ PM2

echo 📦 Проверка зависимостей...
npm install

echo.
echo 🔧 Запуск сервера...
echo Сервер будет запущен в фоновом режиме
echo Для остановки нажмите Ctrl+C

echo.
echo 🌐 Сервер доступен по адресу:
echo    http://localhost:3001
echo.
echo 📊 Проверка работы:
curl -s http://localhost:3001/health

echo.
echo ✅ СЕРВЕР ЗАПУЩЕН!
echo.
echo 🎯 ОТКРЫВАЙТЕ:
echo    🌐 Сайт: https://bloknotservis.ru
echo    📊 Health: http://localhost:3001/health
echo    🔐 Auth: http://localhost:3001/api/auth/magic-link
echo.
echo ⏹️  Для остановки нажмите Ctrl+C

node index.js
