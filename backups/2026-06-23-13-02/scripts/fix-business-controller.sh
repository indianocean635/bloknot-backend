#!/bin/bash
# Исправление ошибки в businessController.js

echo "=== ИСПРАВЛЕНИЕ BUSINESSCONTROLLER.JS ==="

# 1. Создать резервную копию
cp /var/www/bloknot-backend/controllers/businessController.js /var/www/bloknot-backend/controllers/businessController.js.backup

# 2. Заменить проблемную функцию getBusinessName
cat > /tmp/getBusinessName_fix.txt << 'EOF'
// Получить название// Get business slug for booking link
async function getBusinessName(req, res) {
  // Get user by email from headers instead of req.user.id
  const userEmail = req.headers['x-user-email'] || req.headers['x-email'];
  
  if (!userEmail) {
    return res.status(401).json({ error: "Unauthorized - No email provided" });
  }
  
  const user = await prisma.user.findUnique({ where: { email: userEmail.toLowerCase() } });
  
  if (!user || !user.businessId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  
  const business = await prisma.business.findUnique({ 
    where: { id: user.businessId }
  });
  
  if (!business) {
    return res.status(404).json({ error: "Business not found" });
  }
  
  res.json({ slug: business.slug });
}
EOF

# 3. Заменить функцию в файле
sed -i '/^\/\/ Получить название\/\/ Get business slug for booking link/,/^}$/c\
// Получить название// Get business slug for booking link\
async function getBusinessName(req, res) {\
  // Get user by email from headers instead of req.user.id\
  const userEmail = req.headers["x-user-email"] || req.headers["x-email"];\
  \
  if (!userEmail) {\
    return res.status(401).json({ error: "Unauthorized - No email provided" });\
  }\
  \
  const user = await prisma.user.findUnique({ where: { email: userEmail.toLowerCase() } });\
  \
  if (!user || !user.businessId) {\
    return res.status(403).json({ error: "Forbidden" });\
  }\
  \
  const business = await prisma.business.findUnique({ \
    where: { id: user.businessId }\
  });\
  \
  if (!business) {\
    return res.status(404).json({ error: "Business not found" });\
  }\
  \
  res.json({ slug: business.slug });\
}' /var/www/bloknot-backend/controllers/businessController.js

echo "✅ Исправление применено"
echo "=== ПЕРЕЗАПУСК СЕРВЕРА ==="

# 4. Перезапустить сервер
pkill -f "node index.js" 2>/dev/null || true
sleep 2
PORT=3001 node index.js &

echo "✅ Сервер перезапущен"
echo "=== ГОТОВО ДЛЯ ТЕСТИРОВАНИЯ ==="
