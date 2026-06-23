#!/bin/bash

# FIX EXTERNAL ACCESS ISSUES
# Execute on server: bash fix-external-access.sh

echo "FIXING EXTERNAL ACCESS ISSUES"
echo "============================"

# 1. Stop nginx completely
echo "1. Stopping nginx:"
systemctl stop nginx
killall nginx 2>/dev/null
sleep 2

# 2. Remove all configs
echo "2. Removing configs:"
rm -f /etc/nginx/sites-enabled/bloknotservis.ru
rm -f /etc/nginx/sites-available/bloknotservis.ru

# 3. Create simple config that listens on all interfaces
echo "3. Creating simple config:"
cat > /etc/nginx/sites-available/bloknotservis.ru << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name bloknotservis.ru www.bloknotservis.ru;

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files
    location / {
        root /var/www/html;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}
EOF

# 4. Enable site
echo "4. Enabling site:"
ln -sf /etc/nginx/sites-available/bloknotservis.ru /etc/nginx/sites-enabled/

# 5. Test config
echo "5. Testing config:"
nginx -t

# 6. Start nginx
echo "6. Starting nginx:"
systemctl start nginx
sleep 2

# 7. Check status
echo "7. Checking status:"
systemctl status nginx --no-pager

# 8. Check ports
echo "8. Checking ports:"
ss -tuln | grep -E ':(80|3001)'

# 9. Test external access
echo "9. Testing external access:"
curl -I http://bloknotservis.ru/ 2>/dev/null | head -1

# 10. Test API
echo "10. Testing API:"
curl -X POST http://bloknotservis.ru/api/auth/send-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com"}' \
  -s | head -1

echo "EXTERNAL ACCESS FIX COMPLETE"
echo "Site should now be accessible from incognito and mobile"
