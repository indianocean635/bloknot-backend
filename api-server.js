const express = require('express');
const app = express();
const PORT = 3002; // ОТДЕЛЬНЫЙ ПОРТ ДЛЯ API

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  console.log('✅ API Health check received');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth endpoint
app.post('/api/auth/magic-link', (req, res) => {
  console.log('🔥 API Auth request received:', req.body);
  const { email } = req.body;
  
  if (!email) {
    console.log('❌ No email provided');
    return res.status(400).json({ error: "Email required" });
  }
  
  const token = 'token_' + Date.now();
  console.log('✅ Token generated:', token);
  
  res.json({ 
    success: true, 
    message: "Login link sent",
    verifyUrl: `https://bloknotservis.ru/auth/verify?token=${token}`
  });
});

// Legacy endpoints
app.post('/auth/request-link', (req, res) => {
  console.log('🔥 Legacy API Auth request received:', req.body);
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: "Email required" });
  }
  
  const token = 'token_' + Date.now();
  console.log('✅ Legacy token generated:', token);
  
  res.json({ 
    success: true, 
    message: "Login link sent",
    verifyUrl: `https://bloknotservis.ru/auth/verify?token=${token}`
  });
});

app.post('/auth/magic-link', (req, res) => {
  console.log('🔥 Alternative API Auth request received:', req.body);
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: "Email required" });
  }
  
  const token = 'token_' + Date.now();
  console.log('✅ Alternative token generated:', token);
  
  res.json({ 
    success: true, 
    message: "Login link sent",
    verifyUrl: `https://bloknotservis.ru/auth/verify?token=${token}`
  });
});

app.listen(PORT, () => {
  console.log(`🚀 API SERVER running on port ${PORT}`);
  console.log(`📊 API Health: http://localhost:${PORT}/health`);
  console.log(`🔐 API Auth: http://localhost:${PORT}/api/auth/magic-link`);
  console.log(`🔐 Legacy: http://localhost:${PORT}/auth/request-link`);
});
