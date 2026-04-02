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

// Health check
app.get('/health', (req, res) => {
  console.log('Health check received');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Verify endpoint for magic links
app.get('/auth/verify', async (req, res) => {
  console.log("VERIFY TOKEN:", req.query.token);
  const { token } = req.query;
  
  if (!token) {
    console.log('❌ No token provided');
    return res.status(400).send("No token");
  }

  // Временно принимаем любой токен для теста
  console.log('✅ Token accepted:', token);
  
  // Временная заглушка пользователя
  const user = {
    id: 'user_' + Math.random().toString(36).substring(2),
    email: 'user@example.com' // временная заглушка
  };
  
  console.log('👤 User logged in:', user);
  
  // Редирект на дашборд
  res.redirect('/dashboard.html');
});

// Static files
app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`🚀 MINIMAL SERVER running on port ${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`🔐 Auth: http://localhost:${PORT}/api/auth/magic-link`);
  console.log(`🔐 Verify: http://localhost:${PORT}/auth/verify?token=TOKEN`);
});
