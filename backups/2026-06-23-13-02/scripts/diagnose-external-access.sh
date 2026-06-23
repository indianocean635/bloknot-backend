#!/bin/bash

# DIAGNOSTIC SCRIPT FOR EXTERNAL ACCESS ISSUES
# Execute on server: bash diagnose-external-access.sh

echo "DIAGNOSING EXTERNAL ACCESS ISSUES"
echo "=================================="

# 1. Check nginx status
echo "1. Nginx status:"
systemctl status nginx --no-pager

# 2. Check ports
echo "2. Port check:"
ss -tuln | grep -E ':(80|443|3001)'

# 3. Check nginx config
echo "3. Nginx config test:"
nginx -t

# 4. Check enabled sites
echo "4. Enabled sites:"
ls -la /etc/nginx/sites-enabled/

# 5. Test local access
echo "5. Local access test:"
curl -I http://localhost/ 2>/dev/null | head -1

# 6. Test domain access
echo "6. Domain access test:"
curl -I http://bloknotservis.ru/ 2>/dev/null | head -1

# 7. Check firewall
echo "7. Firewall status:"
ufw status 2>/dev/null || iptables -L | head -10

# 8. Check if nginx is listening on correct interface
echo "8. Nginx listening interfaces:"
netstat -tlnp | grep nginx

# 9. Test API locally
echo "9. API local test:"
curl -X POST http://localhost:3001/api/auth/send-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com"}' \
  -s | head -1

# 10. Test API through domain
echo "10. API domain test:"
curl -X POST http://bloknotservis.ru/api/auth/send-link \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com"}' \
  -s | head -1

echo "DIAGNOSIS COMPLETE"
