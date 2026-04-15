#!/bin/bash

echo "=== FORCE UPDATE SERVER ==="

# Reset to clean state
git reset --hard origin/main

# Pull latest changes
git pull origin main

# Check syntax
echo "Checking server syntax..."
node -c routes/authRoutes.js
if [ $? -eq 0 ]; then
    echo "Syntax OK"
else
    echo "SYNTAX ERROR - checking file:"
    tail -10 routes/authRoutes.js
fi

# Install dependencies if needed
npm ci

# Restart application
pm2 restart bloknot

# Wait and check status
sleep 3
pm2 status

echo "=== FORCE UPDATE COMPLETE ==="
