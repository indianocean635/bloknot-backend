#!/bin/bash

echo "=== Checking Firewall Rules ==="
echo ""

# Check iptables rules
echo "Current iptables rules:"
sudo iptables -L -n -v
echo ""

# Check if UFW is active
echo "UFW status:"
sudo ufw status
echo ""

# Check if firewalld is active
echo "Firewalld status:"
sudo systemctl status firewalld 2>/dev/null || echo "Firewalld not installed"
echo ""

# Check open ports
echo "Listening ports:"
sudo netstat -tlnp
echo ""

# Check nginx status
echo "Nginx status:"
sudo systemctl status nginx
echo ""

# Check if there are any IP restrictions in nginx
echo "Checking nginx config for IP restrictions:"
sudo grep -r "allow\|deny" /etc/nginx/ 2>/dev/null || echo "No IP restrictions found in nginx"
echo ""

echo "=== Firewall Check Complete ==="
