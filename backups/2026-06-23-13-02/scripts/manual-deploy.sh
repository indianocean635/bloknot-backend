#!/bin/bash

echo "=== MANUAL DEPLOY ==="

cd /var/www/bloknot-backend

# Try HTTPS first
echo "Trying HTTPS..."
git remote set-url origin https://github.com/indianocean635/bloknot-backend.git
git pull origin main

if [ $? -eq 0 ]; then
    echo "Git pull successful!"
else
    echo "Git failed, downloading manually..."
    
    # Download manually
    wget -O main.zip https://github.com/indianocean635/bloknot-backend/archive/main.zip
    unzip -o main.zip
    cp -r bloknot-backend-main/* .
    rm -rf main.zip bloknot-backend-main
fi

# Install dependencies
echo "Installing dependencies..."
npm ci

# Update database
echo "Updating database..."
npx prisma db push
npx prisma generate

# Copy files
echo "Copying files..."
cp -r public/* /var/www/html/

# Restart
echo "Restarting PM2..."
pm2 reload ecosystem.config.js --only bloknot --update-env

echo "=== DONE ==="
