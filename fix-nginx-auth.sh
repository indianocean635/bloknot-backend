#!/bin/bash

# FIX NGINX TO PROXY /auth/ REQUESTS
# Execute on server: bash fix-nginx-auth.sh

echo "FIXING NGINX TO PROXY /auth/ REQUESTS"
echo "======================================"

# 1. Show current nginx config
echo "1. Current nginx config:"
cat /etc/nginx/sites-enabled/bloknotservis.ru

# 2. Update nginx config to proxy /auth/ requests
echo "2. Updating nginx config..."
cat > /etc/nginx/sites-enabled/bloknotservis.ru << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name bloknotservis.ru www.bloknotservis.ru;

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
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

    # Auth proxy - FIX FOR MAGIC LINK!
    location /auth/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Disable caching for auth
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

# 3. Test nginx config
echo "3. Testing nginx config:"
nginx -t

# 4. Restart nginx
echo "4. Restarting nginx:"
systemctl restart nginx

# 5. Check nginx status
echo "5. Checking nginx status:"
systemctl status nginx

# 6. Test magic link
echo "6. Testing magic link:"
curl -I "http://bloknotservis.ru/auth/magic-link?token=test"

echo "NGINX AUTH FIX COMPLETE"
echo "Magic links should now work!"
