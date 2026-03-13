@echo off
echo === Preparing Frontend for Deployment ===
echo.

echo Current directory: %CD%
echo.

echo 1. Creating frontend archive...
echo.

cd /d c:\Users\User\Desktop\bloknot-backend

echo Creating tar.gz archive...
tar -czf bloknot-frontend.tar.gz public/

echo.
echo 2. Archive created: bloknot-frontend.tar.gz
echo.

echo 3. Archive contents:
tar -tzf bloknot-frontend.tar.gz | head -20

echo.
echo === Instructions for server deployment ===
echo.
echo 1. Upload bloknot-frontend.tar.gz to server: /var/www/
echo 2. On server run:
echo    cd /var/www/
echo    tar -xzf bloknot-frontend.tar.gz
echo    mv public bloknot-frontend
echo.
echo 3. Setup Nginx configuration (see FRONTEND_DEPLOYMENT.md)
echo.
echo 4. Restart Nginx: sudo systemctl restart nginx
echo.

pause
