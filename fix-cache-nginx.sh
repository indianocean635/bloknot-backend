#!/bin/bash

echo "=== FIXING NGINX CACHE FOR SETTINGS.HTML ==="

# Create Nginx config to disable cache for settings.html
cat > /tmp/settings-cache-fix.conf << 'EOF'
# Disable cache for settings.html
location ~* /settings\.html$ {
    add_header Cache-Control "no-cache, no-store, must-revalidate, max-age=0, post-check=0, pre-check=0";
    add_header Pragma "no-cache";
    add_header Expires "0";
    add_header Surrogate-Control "no-store";
    
    # Security headers
    add_header X-Content-Type-Options "nosniff";
    add_header X-Frame-Options "DENY";
    add_header X-XSS-Protection "1; mode=block";
    
    try_files $uri $uri/ /settings.html;
}

# Disable cache for API endpoints
location /api/ {
    add_header Cache-Control "no-cache, no-store, must-revalidate, max-age=0";
    add_header Pragma "no-cache";
    add_header Expires "0";
    
    proxy_pass http://localhost:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
EOF

echo "Adding cache fix to Nginx config..."

# Backup current config
cp /etc/nginx/sites-available/bloknotservis.ru /etc/nginx/sites-available/bloknotservis.ru.backup.$(date +%Y%m%d_%H%M%S)

# Add cache fix to existing config
if ! grep -q "Disable cache for settings.html" /etc/nginx/sites-available/bloknotservis.ru; then
    echo "Adding settings.html cache rules..."
    cat /tmp/settings-cache-fix.conf >> /etc/nginx/sites-available/bloknotservis.ru
else
    echo "Cache rules already exist"
fi

# Test Nginx config
echo "Testing Nginx config..."
nginx -t

if [ $? -eq 0 ]; then
    echo "Nginx config is valid, restarting..."
    systemctl restart nginx
    echo "Nginx restarted successfully"
else
    echo "Nginx config error, reverting..."
    cp /etc/nginx/sites-available/bloknotservis.ru.backup.$(date +%Y%m%d_%H%M%S) /etc/nginx/sites-available/bloknotservis.ru
    systemctl restart nginx
fi

# Clear browser cache instructions
echo ""
echo "=== BROWSER CACHE CLEAR INSTRUCTIONS ==="
echo "1. Press Ctrl+F5 (hard refresh)"
echo "2. Or press Ctrl+Shift+R"
echo "3. Or open Developer Tools (F12) -> Network tab -> Check 'Disable cache'"
echo "4. Or clear browser data manually"
echo ""
echo "Settings URL: https://bloknotservis.ru/settings.html?nocache=$(date +%s)"

# Clean up
rm -f /tmp/settings-cache-fix.conf

echo "=== DONE ==="
