#!/bin/bash

echo "🔧 PRISMA CRITICAL FIX"

echo "🗑️ FULL CLEANUP"
rm -rf node_modules package-lock.json
rm -rf .next
rm -rf prisma/generated
npm cache clean --force

echo ""
echo "📦 INSTALL DEPENDENCIES"
npm install

echo ""
echo "🔧 PRISMA GENERATE"
npx prisma generate

echo ""
echo "🗄️ DATABASE PUSH"
npx prisma db push

echo ""
echo "🔄 PM2 RESTART"
pm2 delete bloknot || true
pm2 start index.js --name bloknot

echo ""
echo "⏱️ WAIT FOR STARTUP"
sleep 5

echo ""
echo "🔍 TEST API"
echo "=== HEALTH CHECK ==="
curl -s http://localhost:3001/health

echo ""
echo "=== AUTH TEST ==="
curl -s -X POST http://localhost:3001/api/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

echo ""
echo "✅ PRISMA FIXED"
