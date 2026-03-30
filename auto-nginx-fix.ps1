# PowerShell Script for NGINX Fix
Write-Host "🔧 AUTOMATIC NGINX FIX - POWERSHELL VERSION" -ForegroundColor Green

# Change to backend directory
Set-Location /var/www/bloknot-backend

Write-Host "`n=== STEP 1: CHECK CURRENT NGINX CONFIG ===" -ForegroundColor Yellow
try {
    sudo cat /etc/nginx/sites-available/bloknotservis.ru
} catch {
    Write-Host "Cannot read nginx config" -ForegroundColor Red
}

Write-Host "`n=== STEP 2: CHECK NGINX STATUS ===" -ForegroundColor Yellow
try {
    sudo netstat -tlnp | grep nginx
} catch {
    Write-Host "Cannot check nginx status" -ForegroundColor Red
}

Write-Host "`n=== STEP 3: CHECK NGINX LOGS ===" -ForegroundColor Yellow
try {
    Write-Host "Recent errors:"
    sudo tail -10 /var/log/nginx/error.log 2>$null
    Write-Host "`nRecent access:"
    sudo tail -10 /var/log/nginx/access.log 2>$null
} catch {
    Write-Host "Cannot read nginx logs" -ForegroundColor Red
}

Write-Host "`n=== STEP 4: CREATE NEW NGINX CONFIG ===" -ForegroundColor Yellow
$nginxConfig = @"
server {
    listen 80;
    server_name bloknotservis.ru www.bloknotservis.ru;
    
    # Redirect to HTTPS
    return 301 https://`$server_name`$request_uri;
}

server {
    listen 443 ssl http2;
    server_name bloknotservis.ru www.bloknotservis.ru;
    
    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/bloknotservis.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bloknotservis.ru/privkey.pem;
    
    # API proxy
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host `$host;
        proxy_set_header X-Real-IP `$remote_addr;
        proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto `$scheme;
        proxy_set_header Content-Type `$content_type;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # Static files
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host `$host;
        proxy_set_header X-Real-IP `$remote_addr;
        proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto `$scheme;
    }
}
"@

try {
    $nginxConfig | sudo tee /etc/nginx/sites-available/bloknotservis.ru > $null
    Write-Host "Nginx config updated successfully" -ForegroundColor Green
} catch {
    Write-Host "Cannot update nginx config" -ForegroundColor Red
}

Write-Host "`n=== STEP 5: TEST NGINX CONFIG ===" -ForegroundColor Yellow
try {
    sudo nginx -t
} catch {
    Write-Host "Nginx config test failed" -ForegroundColor Red
}

Write-Host "`n=== STEP 6: RESTART NGINX ===" -ForegroundColor Yellow
try {
    sudo systemctl restart nginx
    Write-Host "Nginx restarted successfully" -ForegroundColor Green
} catch {
    Write-Host "Cannot restart nginx" -ForegroundColor Red
}

Write-Host "`n=== STEP 7: CHECK NGINX STATUS ===" -ForegroundColor Yellow
try {
    sudo systemctl status nginx
} catch {
    Write-Host "Cannot check nginx status" -ForegroundColor Red
}

Write-Host "`n=== STEP 8: TEST BACKEND DIRECT ===" -ForegroundColor Yellow
try {
    Write-Host "Testing http://localhost:3001/health"
    curl -s http://localhost:3001/health
    
    Write-Host "`nTesting POST to http://localhost:3001/api/auth/magic-link"
    curl -s -X POST http://localhost:3001/api/auth/magic-link -H "Content-Type: application/json" -d '{"email":"test@example.com"}'
} catch {
    Write-Host "Cannot test backend directly" -ForegroundColor Red
}

Write-Host "`n=== STEP 9: TEST THROUGH NGINX ===" -ForegroundColor Yellow
try {
    Write-Host "Testing https://bloknotservis.ru/health"
    curl -s https://bloknotservis.ru/health
    
    Write-Host "`nTesting POST to https://bloknotservis.ru/api/auth/magic-link"
    curl -s -X POST https://bloknotservis.ru/api/auth/magic-link -H "Content-Type: application/json" -d '{"email":"test@example.com"}'
} catch {
    Write-Host "Cannot test through nginx" -ForegroundColor Red
}

Write-Host "`n=== STEP 10: FINAL VERIFICATION ===" -ForegroundColor Yellow
try {
    Write-Host "Check PM2 status:"
    pm2 status
    
    Write-Host "`nCheck recent nginx logs:"
    sudo tail -5 /var/log/nginx/access.log
} catch {
    Write-Host "Cannot check final status" -ForegroundColor Red
}

Write-Host "`n✅ AUTOMATIC NGINX FIX COMPLETED!" -ForegroundColor Green
Write-Host "🌐 NOW TEST: https://bloknotservis.ru" -ForegroundColor Cyan
