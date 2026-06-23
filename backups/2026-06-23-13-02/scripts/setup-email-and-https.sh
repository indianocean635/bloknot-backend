#!/bin/bash

# SETUP EMAIL SENDING AND HTTPS
# Execute on server: bash setup-email-and-https.sh

echo "SETUP EMAIL SENDING AND HTTPS"
echo "============================="

# 1. Check current environment
echo "1. Current environment:"
cd /var/www/bloknot-backend
ls -la .env* 2>/dev/null || echo "No .env files found"

# 2. Create .env file with email settings
echo "2. Creating .env file:"
cat > .env << 'EOF'
# Email settings for magic link
SMTP_HOST=smtp.mail.ru
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=peskov142@mail.ru
SMTP_PASS=your_password_here
SMTP_FROM=peskov142@mail.ru

# Domain settings
DOMAIN=https://bloknotservis.ru
EOF

echo "Created .env file - PLEASE UPDATE SMTP_PASS with real password"

# 3. Show current .env
echo "3. Current .env file:"
cat .env

# 4. Check if certbot is installed
echo "4. Check certbot:"
which certbot || echo "Certbot not installed"

# 5. Setup HTTPS if certbot available
if which certbot >/dev/null 2>&1; then
    echo "5. Setting up HTTPS:"
    
    # Stop nginx first
    systemctl stop nginx
    
    # Get SSL certificate
    certbot --nginx -d bloknotservis.ru -d www.bloknotservis.ru --non-interactive --agree-tos --email peskov142@mail.ru
    
    # Start nginx
    systemctl start nginx
    
    # Check HTTPS
    echo "6. Check HTTPS:"
    curl -I https://bloknotservis.ru/ 2>/dev/null | head -1 || echo "HTTPS not working yet"
    
else
    echo "5. Installing certbot first:"
    apt update
    apt install certbot python3-certbot-nginx -y
    
    echo "6. Run HTTPS setup manually:"
    echo "certbot --nginx -d bloknotservis.ru -d www.bloknotservis.ru"
fi

# 7. Restart PM2 to load .env
echo "7. Restart PM2 to load .env:"
pm2 restart bloknot

# 8. Test email sending
echo "8. Test email sending:"
curl -X POST http://localhost:3001/api/auth/send-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}' \
  -s | head -1

echo "SETUP COMPLETE"
echo "1. Update .env file with real SMTP password"
echo "2. Restart PM2: pm2 restart bloknot"
echo "3. Test email sending"
echo "4. Setup HTTPS if not done automatically"
