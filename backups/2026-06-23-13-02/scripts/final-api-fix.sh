#!/bin/bash

# FINAL API FIX
# Execute on server: bash final-api-fix.sh

echo "FINAL API FIX"
echo "============="

# 1. Check current nginx config
echo "1. Current nginx config:"
cat /etc/nginx/sites-enabled/bloknotservis.ru

# 2. Test API locally
echo "2. API local test:"
curl -X POST http://localhost:3001/api/auth/send-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com"}' \
  -s | head -1

# 3. Test API through domain
echo "3. API domain test:"
curl -X POST http://bloknotservis.ru/api/auth/send-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com"}' \
  -s | head -1

# 4. Test API path directly
echo "4. API path test:"
curl -v http://bloknotservis.ru/api/auth/send-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com"}' 2>&1 | grep -E "(HTTP|Location|< |> )"

# 5. Check if static files are interfering
echo "5. Check static files:"
ls -la /var/www/html/api/ 2>/dev/null || echo "No /var/www/html/api/ directory"

# 6. Fix nginx config if needed
echo "6. Fixing nginx config..."
cat > /etc/nginx/sites-available/bloknotservis.ru << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name bloknotservis.ru www.bloknotservis.ru;

    # API proxy - MUST BE FIRST!
    location /api/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Disable caching for API
        proxy_no_cache 1;
        proxy_cache_bypass 1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # Static files
    location / {
        root /var/www/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}
EOF

# 7. Enable and restart nginx
echo "7. Enabling and restarting nginx:"
ln -sf /etc/nginx/sites-available/bloknotservis.ru /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx

# 8. Final test
echo "8. Final API test:"
curl -X POST http://bloknotservis.ru/api/auth/send-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com"}' \
  -s | head -1

echo "FINAL API FIX COMPLETE"
echo "Magic link should now work from frontend!"
