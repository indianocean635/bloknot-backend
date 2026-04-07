#!/bin/bash

# CRITICAL API FIX - PROXY PASS ISSUE
# Execute on server: bash critical-api-fix.sh

echo "CRITICAL API FIX - PROXY PASS ISSUE"
echo "===================================="

# 1. Test backend directly
echo "1. Test backend directly:"
curl -X POST http://localhost:3001/api/auth/send-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com"}' \
  -s | head -1

# 2. Test what nginx is proxying to
echo "2. Test what nginx is proxying to:"
curl -X POST http://localhost:3001/ \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com"}' \
  -s | head -1

# 3. Fix nginx config - CRITICAL FIX
echo "3. Fixing nginx config - CRITICAL FIX:"
cat > /etc/nginx/sites-available/bloknotservis.ru << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name bloknotservis.ru www.bloknotservis.ru;

    # API proxy - FIXED PATH
    location /api/ {
        proxy_pass http://127.0.0.1:3001;  # NO TRAILING SLASH!
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

# 4. Enable and restart nginx
echo "4. Enabling and restarting nginx:"
ln -sf /etc/nginx/sites-available/bloknotservis.ru /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx

# 5. Test API through domain
echo "5. Test API through domain:"
curl -X POST http://bloknotservis.ru/api/auth/send-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com"}' \
  -s | head -1

# 6. Test with verbose output
echo "6. Test with verbose output:"
curl -v http://bloknotservis.ru/api/auth/send-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com"}' 2>&1 | grep -E "(HTTP|Location|< |> )"

echo "CRITICAL API FIX COMPLETE"
echo "API should now work correctly!"
