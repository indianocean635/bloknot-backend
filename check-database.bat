@echo off
echo === Checking Database Configuration ===
echo.

echo Current DATABASE_URL from .env:
findstr "DATABASE_URL" .env

echo.
echo === Checking for local database files ===
echo.

dir /s *.db 2>nul
dir /s dev.db 2>nul
dir /s *.sqlite* 2>nul

echo.
echo === Checking Prisma status ===
echo.

npx prisma db pull --preview-feature 2>&1 | head -10

pause
