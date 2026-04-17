#!/bin/bash

# Bloknot Quick Restore Script
# Restores project to perfect working state (Git Commit: 7ef21ef)

echo "=== Bloknot Quick Restore ==="
echo "Restoring to PERFECT WORKING STATE..."
echo "Git Commit: 7ef21ef"
echo ""

# Stop current application
echo "Step 1: Stopping application..."
pm2 stop bloknot

# Go to backend directory
cd /var/www/bloknot-backend

# Restore Git state
echo "Step 2: Restoring Git state..."
git fetch origin
git checkout 7ef21ef
git reset --hard 7ef21ef

# Install dependencies
echo "Step 3: Installing dependencies..."
npm install

# Apply database migrations
echo "Step 4: Applying database migrations..."
npx prisma migrate deploy

# Copy static files
echo "Step 5: Copying static files..."
cp -r public/* /var/www/html/
chown -R www-data:www-data /var/www/html/

# Start application
echo "Step 6: Starting application..."
pm2 start bloknot

# Wait and verify
echo "Step 7: Verifying..."
sleep 5

echo ""
echo "=== Restore Complete ==="
echo "Testing with registration..."

# Test registration
curl -X POST "http://localhost:3001/api/auth/request-login" \
  -H "Content-Type: application/json" \
  -d '{"email":"restore-test@example.com","name":"Restore Test","phone":"+12345678999","password":"restoretest"}'

echo ""
echo "Check logs: pm2 logs --lines 10"
echo ""
echo "=== Project Restored to Perfect Working State ==="
