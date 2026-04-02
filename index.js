const express = require('express');
const path = require('path');
const fs = require('fs');
const authRoutes = require('./routes/authRoutes');
const app = express();
const PORT = 3001;

// Создаем необходимые папки
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.mkdirSync(path.join(uploadsDir, 'avatars'), { recursive: true });
  fs.mkdirSync(path.join(uploadsDir, 'works'), { recursive: true });
}

app.use(express.json());

// API routes
app.use('/api/auth', authRoutes);

// Прямой алиас для magic-link (если роуты не работают)
app.post('/api/auth/magic-link', async (req, res) => {
  console.log('🔥 DIRECT MAGIC-LINK REQUEST RECEIVED');
  console.log('🔥 Body:', req.body);
  
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: "Email required" });
  }
  
  // Генерируем токен
  const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
  
  // Формируем полную ссылку
  const fullLink = `https://bloknotservis.ru/auth/verify?token=${token}`;
  
  console.log('🔗 LOGIN LINK:', fullLink);
  console.log('👤 User:', email);
  
  res.json({ 
    success: true,
    message: "Login link sent successfully",
    verifyUrl: fullLink
  });
});

// Health check
app.get('/health', (req, res) => {
  console.log('Health check received');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Verify endpoint for magic links
app.get('/auth/verify', async (req, res) => {
  const token = req.query.token;
  console.log("VERIFY TOKEN:", token);

  if (!token) {
    return res.status(400).send("No token");
  }

  return res.redirect('/dashboard.html');
});

// Static files
app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`🚀 MINIMAL SERVER running on port ${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`🔐 Auth: http://localhost:${PORT}/api/auth/magic-link`);
  console.log(`🔐 Verify: http://localhost:${PORT}/auth/verify?token=TOKEN`);
});
