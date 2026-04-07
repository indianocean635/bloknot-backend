#!/bin/bash

# FIX PM2 ENVIRONMENT VARIABLES
# Execute on server: bash fix-pm2-env.sh

echo "FIXING PM2 ENVIRONMENT VARIABLES"
echo "================================"

# 1. Check current .env
echo "1. Current .env file:"
cat .env

# 2. Stop PM2
echo "2. Stopping PM2:"
pm2 delete bloknot

# 3. Start PM2 with env file
echo "3. Starting PM2 with env file:"
pm2 start index.js --name bloknot --env production

# 4. Check environment variables
echo "4. Checking environment variables:"
pm2 env 0 | grep -E "(SMTP|MAIL|DOMAIN)"

# 5. Check logs for SMTP initialization
echo "5. Checking logs for SMTP:"
pm2 logs bloknot --lines 10

# 6. Test email sending
echo "6. Testing email sending:"
curl -X POST http://localhost:3001/api/auth/send-link \
  -H "Content-Type: application/json" \
  -d '{"email":"peskov142@mail.ru"}' \
  -s | head -1

echo "PM2 ENVIRONMENT FIX COMPLETE"
