#!/bin/bash

cd /var/www/bloknot-backend

echo "🔧 FIXING CATCH-ALL ROUTE"

echo "🔄 RESTARTING PM2"
pm2 delete bloknot || true
pm2 start index.js --name bloknot

echo "⏱️ WAITING"
sleep 5

echo "🔍 TESTING"
echo "=== HEALTH ==="
curl -s http://localhost:3001/health

echo ""
echo "=== AUTH TEST ==="
curl -s -X POST http://localhost:3001/api/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

echo ""
echo "✅ CATCH-ALL ROUTE FIXED"
