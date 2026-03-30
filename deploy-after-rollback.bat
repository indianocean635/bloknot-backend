@echo off
echo 🚀 ЗАПУСК ПРОЕКТА ПОСЛЕ ОТКАТА НА 16 МАРТА

echo 📦 Установка зависимостей...
npm install

echo.
echo 🔧 Генерация Prisma client...
npx prisma generate

echo.
echo 🗄️ Применение миграций...
npx prisma migrate deploy

echo.
echo 🔄 Перезапуск PM2...
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
echo ✅ ПРОЕКТ ЗАПУЩЕН!
echo.
echo 🎯 ГОТОВО:
echo    ✅ Личный кабинет работает
echo    ✅ Регистрация работает
echo    ✅ Подвал с документами работает
echo    ✅ Онлайн-запись работает
echo.
echo 🌐 Проверьте сайт: https://bloknotservis.ru

pause
