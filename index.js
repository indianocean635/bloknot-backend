require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3001;

// Защита от множественных запусков
let serverStarted = false;

// Middleware
app.use(cors({
  origin: ['https://bloknotservis.ru', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static('public'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Временное хранилище
const memoryUsers = new Map();
const memoryTokens = new Map();

// ВСЕ ВОЗМОЖНЫЕ URL ДЛЯ АВТОРИЗАЦИИ
app.post('/api/auth/magic-link', async (req, res) => {
  try {
    console.log('🔥 /api/auth/magic-link REQUEST');
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });
    
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    memoryTokens.set(token, { email, createdAt: new Date() });
    
    console.log('✅ /api/auth/magic-link RESPONSE');
    res.json({ success: true, verifyUrl: `https://bloknotservis.ru/auth/verify?token=${token}` });
  } catch (error) {
    console.error('❌ /api/auth/magic-link ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/auth/request-link', async (req, res) => {
  try {
    console.log('🔥 /auth/request-link REQUEST');
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });
    
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    memoryTokens.set(token, { email, createdAt: new Date() });
    
    console.log('✅ /auth/request-link RESPONSE');
    res.json({ success: true, verifyUrl: `https://bloknotservis.ru/auth/verify?token=${token}` });
  } catch (error) {
    console.error('❌ /auth/request-link ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/auth/magic-link', async (req, res) => {
  try {
    console.log('🔥 /auth/magic-link REQUEST');
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });
    
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    memoryTokens.set(token, { email, createdAt: new Date() });
    
    console.log('✅ /auth/magic-link RESPONSE');
    res.json({ success: true, verifyUrl: `https://bloknotservis.ru/auth/verify?token=${token}` });
  } catch (error) {
    console.error('❌ /auth/magic-link ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Catch all для SPA
app.get('*', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Start server
if (!serverStarted) {
  serverStarted = true;
  
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Health: http://localhost:${PORT}/health`);
    console.log(`🔐 Auth endpoints available:`);
    console.log(`   POST /api/auth/magic-link`);
    console.log(`   POST /auth/request-link`);
    console.log(`   POST /auth/magic-link`);
  });
  
  process.on('SIGTERM', () => {
    console.log('📴 SIGTERM received, shutting down gracefully');
    process.exit(0);
  });
  
  process.on('SIGINT', () => {
    console.log('📴 SIGINT received, shutting down gracefully');
    process.exit(0);
  });
}
