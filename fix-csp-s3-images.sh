#!/bin/bash

echo "🔧 FIXING CSP FOR S3 IMAGES"
echo "================================"

# Backup current nginx config
sudo cp /etc/nginx/sites-available/bloknotservis.ru /etc/nginx/sites-available/bloknotservis.ru.backup-$(date +%Y%m%d-%H%M%S)

# Update CSP to include s3.storage.selcloud.ru
echo "📝 Updating Content Security Policy..."

# Create temporary config with updated CSP
cat > /tmp/csp-fix.conf << 'EOF'
server {
    server_name bloknotservis.ru www.bloknotservis.ru;

    # Security headers for CloudPayments + S3 images
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline' 'unsafe-eval'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://widget.cloudpayments.ru https://static.cloudpayments.ru https://static-stage.cloudpayments.ru https://cdn.cloudpayments.ru https://cp.ru https://fingerprint.t-static.ru https://forma.tinkoff.ru https://pay.google.com; connect-src 'self' https://widget.cloudpayments.ru https://api.cloudpayments.ru https://intent-api.cloudpayments.ru https://fingerprint.t-static.ru https://forma.tinkoff.ru https://pay.google.com; img-src 'self' data: https://widget.cloudpayments.ru https://static.cloudpayments.ru https://static-stage.cloudpayments.ru https://cp.ru https://qr.nspk.ru https://cdn.cloudpayments.ru https://www.gstatic.com https://intent-api.cloudpayments.ru https://s3.storage.selcloud.ru" always;

    # API proxy
    location /api/ {
        client_max_body_size 50M;
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
        client_max_body_size 50M;
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

    listen [::]:443 ssl ipv6only=on;
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/bloknotservis.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bloknotservis.ru/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    if ($host = www.bloknotservis.ru) {
        return 301 https://$host$request_uri;
    }

    if ($host = bloknotservis.ru) {
        return 301 https://$host$request_uri;
    }

    listen 80;
    listen [::]:80;
    server_name bloknotservis.ru www.bloknotservis.ru;
    return 404;
}
EOF

# Apply the fix
sudo cp /tmp/csp-fix.conf /etc/nginx/sites-available/bloknotservis.ru

# Test nginx configuration
echo "🧪 Testing nginx configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx configuration is valid"
    
    # Reload nginx
    echo "🔄 Reloading nginx..."
    sudo systemctl reload nginx
    
    if [ $? -eq 0 ]; then
        echo "✅ Nginx reloaded successfully"
        echo "🎉 CSP updated! S3 images should now load properly"
        
        # Clear browser cache instructions
        echo ""
        echo "📋 NEXT STEPS:"
        echo "1. Clear browser cache (Ctrl+Shift+R)"
        echo "2. Refresh the page"
        echo "3. Check if images load properly"
        echo ""
        echo "🔍 VERIFICATION:"
        echo "- Logo should load from s3.storage.selcloud.ru"
        echo "- Work photos should load from s3.storage.selcloud.ru"
        echo "- Staff avatars should load from s3.storage.selcloud.ru"
    else
        echo "❌ Failed to reload nginx"
        echo "🔄 Restoring backup..."
        sudo cp /etc/nginx/sites-available/bloknotservis.ru.backup-$(date +%Y%m%d-%H%M%S) /etc/nginx/sites-available/bloknotservis.ru
        sudo systemctl reload nginx
    fi
else
    echo "❌ Nginx configuration test failed"
    echo "🔄 Restoring backup..."
    sudo cp /etc/nginx/sites-available/bloknotservis.ru.backup-$(date +%Y%m%d-%H%M%S) /etc/nginx/sites-available/bloknotservis.ru
fi

# Cleanup
rm -f /tmp/csp-fix.conf

echo ""
echo "📊 SUMMARY:"
echo "- Added s3.storage.selcloud.ru to img-src CSP directive"
echo "- Images from S3 storage should now load properly"
echo "- No changes to database or application logic"
