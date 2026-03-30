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

// ПРЯМОЙ ОБРАБОТЧИК authRoutes
app.post('/api/auth/magic-link', async (req, res) => {
  try {
    console.log('🔥 MAGIC-LINK REQUEST RECEIVED');
    console.log('🔥 Headers:', req.headers);
    console.log('🔥 Body:', req.body);
    
    const { email } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    
    if (!normalizedEmail) {
      console.log('❌ NO EMAIL PROVIDED');
      return res.status(400).json({ error: "Email required" });
    }

    // Создаем или получаем пользователя
    let user = memoryUsers.get(normalizedEmail);
    if (!user) {
      user = {
        id: 'user_' + Math.random().toString(36).substring(2),
        email: normalizedEmail,
        role: 'OWNER',
        businessId: 'business_' + Math.random().toString(36).substring(2),
        createdAt: new Date()
      };
      memoryUsers.set(normalizedEmail, user);
    }

    // Генерируем токен
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    
    // Сохраняем токен
    memoryTokens.set(token, {
      userId: user.id,
      email: normalizedEmail,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });

    console.log('🔗 LOGIN LINK:', `https://bloknotservis.ru/auth/verify?token=${token}`);
    console.log('👤 User:', normalizedEmail);
    console.log('✅ MAGIC-LINK RESPONSE SENT');

    res.json({ 
      success: true,
      message: "Login link sent successfully",
      verifyUrl: `https://bloknotservis.ru/auth/verify?token=${token}`
    });

  } catch (error) {
    console.error('❌ MAGIC-LINK ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Catch all for SPA
app.get('*', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Start server
if (!serverStarted) {
  serverStarted = true;
  
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Health: http://localhost:${PORT}/health`);
    console.log(`🔐 Auth: http://localhost:${PORT}/api/auth/magic-link`);
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
