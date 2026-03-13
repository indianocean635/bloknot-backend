@echo off
echo === Regenerating Prisma Client ===
echo.
echo Running: npx prisma generate
echo.

npx prisma generate

echo.
echo === Prisma Generation Complete ===
echo.
echo Now testing server...
echo.

node test-server.js

pause
