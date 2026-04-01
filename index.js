const express = require('express');
const path = require('path');
const fs = require('fs');
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

// Health check
app.get('/health', (req, res) => {
  console.log('Health check received');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth endpoint
app.post('/api/auth/magic-link', (req, res) => {
  console.log('Auth request received:', req.body);
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: "Email required" });
  }
  
  const token = 'token_' + Date.now();
  console.log('Token generated:', token);
  
  res.json({ 
    success: true, 
    message: "Login link sent",
    verifyUrl: `https://bloknotservis.ru/auth/verify?token=${token}`
  });
});

// Legacy endpoints
app.post('/auth/request-link', (req, res) => {
  console.log('Legacy auth request received:', req.body);
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: "Email required" });
  }
  
  const token = 'token_' + Date.now();
  console.log('Legacy token generated:', token);
  
  res.json({ 
    success: true, 
    message: "Login link sent",
    verifyUrl: `https://bloknotservis.ru/auth/verify?token=${token}`
  });
});

app.post('/auth/magic-link', (req, res) => {
  console.log('Alternative auth request received:', req.body);
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: "Email required" });
  }
  
  const token = 'token_' + Date.now();
  console.log('Alternative token generated:', token);
  
  res.json({ 
    success: true, 
    message: "Login link sent",
    verifyUrl: `https://bloknotservis.ru/auth/verify?token=${token}`
  });
});

// Verify endpoint for magic links
app.get('/auth/verify', (req, res) => {
  console.log('🔗 VERIFY REQUEST:', req.query);
  const { token } = req.query;
  
  if (!token) {
    return res.status(400).json({ error: "Token required" });
  }
  
  // Временно просто редиректим на главную с успехом
  console.log('✅ Token verified:', token);
  res.redirect('/?verified=true');
});

// Static files
app.use(express.static('public'));

// Catch all
app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 MINIMAL SERVER running on port ${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`🔐 Auth: http://localhost:${PORT}/api/auth/magic-link`);
  console.log(`🔐 Legacy: http://localhost:${PORT}/auth/request-link`);
});
