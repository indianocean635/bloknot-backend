#!/bin/bash

echo "🔧 DEPLOYING CSP FOR CLOUDPAYMENTS..."

# 1. Create backup
echo "📋 Creating backup..."
sudo cp /etc/nginx/sites-available/bloknotservis.ru /etc/nginx/sites-available/bloknotservis.ru.backup3

# 2. Replace configuration with CSP
echo "🔄 Replacing nginx configuration..."
sudo cp /var/www/bloknot-backend/bloknotservis.ru-complete.conf /etc/nginx/sites-available/bloknotservis.ru

# 3. Test configuration
echo "🧪 Testing nginx configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Configuration test passed!"
    
    # 4. Reload nginx
    echo "🔄 Reloading nginx..."
    sudo systemctl reload nginx
    
    # 5. Check CSP headers
    echo "🔍 Checking CSP headers..."
    curl -I https://bloknotservis.ru/settings.html | grep -i "content-security-policy"
    
    if [ $? -eq 0 ]; then
        echo "✅ CSP headers successfully deployed!"
        echo "🎯 CloudPayments widget should now work correctly!"
    else
        echo "❌ CSP headers not found. Checking all headers..."
        curl -I https://bloknotservis.ru/settings.html
    fi
else
    echo "❌ Configuration test failed!"
    echo "🔄 Restoring backup..."
    sudo cp /etc/nginx/sites-available/bloknotservis.ru.backup3 /etc/nginx/sites-available/bloknotservis.ru
    sudo nginx -t
fi

echo "🏁 Deployment completed!"
