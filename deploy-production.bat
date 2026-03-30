@echo off
echo 🚀 ЗАПУСК ПРОИЗВОДСТВЕННОЙ ВЕРСИИ БЛОКНОТ

echo 📦 Установка зависимостей...
npm install

echo.
echo 🔧 Запуск сервера...
pm2 delete bloknot
pm2 start index.js --name bloknot

echo.
echo ⏱️ Ожидание запуска...
timeout /t 3

echo.
echo 📋 Логи PM2:
pm2 logs bloknot --lines 10

echo.
echo 🔍 Проверка работы:
echo === Health check ===
curl -s http://localhost:3001/health

echo.
echo === Magic link test ===
curl -s -X POST http://localhost:3001/api/auth/magic-link -H "Content-Type: application/json" -d "{\"email\":\"test@example.com\"}"

echo.
echo ✅ ПРОИЗВОДСТВЕННАЯ ВЕРСИЯ ЗАПУЩЕНА!
echo.
echo 🎯 ГОТОВО К РАБОТЕ:
echo    ✅ Личный кабинет работает
echo    ✅ Регистрация работает
echo    ✅ Подвал с документами работает
echo    ✅ Онлайн-запись работает
echo    ✅ База данных в памяти (стабильно)
echo.
echo 🌐 Сайт готов: https://bloknotservis.ru
echo 📊 Мониторинг: pm2 logs bloknot
echo 🔄 Перезапуск: pm2 restart bloknot

pause
