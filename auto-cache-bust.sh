#!/bin/bash

# AUTO CACHE BUSTING SCRIPT
# Execute on server: bash auto-cache-bust.sh

echo "AUTO CACHE BUSTING FOR BLOKNOT"
echo "==============================="

# 1. Update cache busting version for all HTML files
echo "1. Updating cache busting versions..."

# Get current timestamp
TIMESTAMP=$(date +%Y%m%d%H%M%S)

# Update dashboard.html
sed -i "s/styles\.css?v=[0-9]*/styles.css?v=$TIMESTAMP/g" /var/www/bloknot-backend/public/dashboard.html
sed -i "s/app\.js?v=[0-9]*/app.js?v=$TIMESTAMP/g" /var/www/bloknot-backend/public/dashboard.html

# Update index.html
sed -i "s/styles\.css/v=$TIMESTAMP/g" /var/www/bloknot-backend/public/index.html

echo "2. Cache busting updated to: $TIMESTAMP"

# 3. Restart PM2
echo "3. Restarting PM2..."
pm2 restart bloknot

# 4. Show status
echo "4. PM2 status:"
pm2 status

echo "AUTO CACHE BUSTING COMPLETE"
echo "All pages now have cache busting version: $TIMESTAMP"
echo "Users will see latest changes immediately!"
