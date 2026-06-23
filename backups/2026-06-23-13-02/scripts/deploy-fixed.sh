#!/bin/bash

# FIXED DEPLOY SCRIPT - NO MORE ERRORS
set -e
cd /var/www/bloknot-backend

# Force update to avoid local changes conflicts
git reset --hard origin/main

# Pull latest changes
git pull origin main

# Install dependencies
npm ci

# Database operations
npx prisma db push
npx prisma generate

# Copy static files
cp -r public/* /var/www/html/

# Restart PM2 with environment variables
pm2 reload ecosystem.config.js --only bloknot --update-env

echo "Deploy completed successfully!"
