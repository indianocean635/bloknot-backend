#!/bin/bash

echo "=== UPDATE SERVER SCRIPT ==="

# Change to project directory
cd /var/www/bloknot-backend

echo "Current directory: $(pwd)"

# Check git status
echo "=== GIT STATUS ==="
git status

# Pull latest changes
echo "=== PULLING LATEST CHANGES ==="
git pull origin main

# Show latest commits
echo "=== LATEST COMMITS ==="
git log --oneline -n 5

# Update database schema
echo "=== UPDATING DATABASE ==="
npx prisma db push

# Generate Prisma client
echo "=== GENERATING PRISMA CLIENT ==="
npx prisma generate

# Install dependencies if needed
echo "=== INSTALLING DEPENDENCIES ==="
npm install

# Restart PM2
echo "=== RESTARTING PM2 ==="
pm2 reload ecosystem.config.js --only bloknot --update-env

# Show PM2 status
echo "=== PM2 STATUS ==="
pm2 status

# Show recent logs
echo "=== RECENT LOGS ==="
pm2 logs --lines 10

echo "=== UPDATE COMPLETE ==="
