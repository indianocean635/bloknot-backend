#!/bin/bash

echo "=== DEPLOY SCRIPT FOR BLOKNOT BACKEND ==="

# Pull latest changes
echo "1. Pulling latest changes..."
git pull origin main

# Restart application
echo "2. Restarting application..."
pm2 restart bloknot

# Check status
echo "3. Checking application status..."
pm2 status

# Show logs
echo "4. Showing recent logs..."
pm2 logs --lines 5

echo "=== DEPLOY COMPLETE ==="
