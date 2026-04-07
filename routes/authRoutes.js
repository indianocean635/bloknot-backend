const express = require('express');
const nodemailer = require('nodemailer');
const router = express.Router();

// Load environment variables from .env file
require('dotenv').config();

// Временное хранилище пользователей и токенов
const memoryUsers = new Map();
const memoryTokens = new Map();

// Email transporter (Yandex SMTP)
let transporter = null;

// Always initialize with existing settings
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  console.log('Email transporter configured with Yandex SMTP');
} else {
  console.log('Email not configured - missing SMTP settings');
}

// POST /api/auth/send-link (алиас для совместимости)
router.post('/send-link', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: "Email required" });
  }
  
  const token = 'token_' + Date.now();
  
  // Store token in memory
  memoryTokens.set(token, { email, createdAt: new Date(), expiresAt: new Date(Date.now() + 3600000) });
  
  // Send email if transporter is configured
  if (transporter) {
    try {
      const verifyUrl = `${process.env.DOMAIN || 'https://bloknotservis.ru'}/auth/magic-link?token=${token}`;
      
      await transporter.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
        to: email,
        subject: 'Bloknot - Ссылка для входа',
        html: `
          <h2>Добро пожаловать в Bloknot!</h2>
          <p>Нажмите на ссылку ниже, чтобы войти в свой аккаунт:</p>
          <p><a href="${verifyUrl}">Войти в аккаунт</a></p>
          <p>Если вы не запрашивали эту ссылку, просто проигнорируйте это письмо.</p>
          <p>Ссылка действительна в течение 1 часа.</p>
        `
      });
      
      console.log('Email sent to:', email);
    } catch (error) {
      console.error('Email sending error:', error);
    }
  } else {
    console.log('Email not sent - transporter not configured');
    console.log('Login link for', email, ':', `${process.env.DOMAIN || 'https://bloknotservis.ru'}/auth/magic-link?token=${token}`);
  }
  
  res.json({
    success: true,
    message: "Login link sent",
    verifyUrl: `${process.env.DOMAIN || 'https://bloknotservis.ru'}/auth/magic-link?token=${token}`
  });
});

// POST /api/auth/magic-link (алиас к send-link)
router.post('/magic-link', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: "Email required" });
  }
  
  const token = 'token_' + Date.now();
  
  // Store token in memory
  memoryTokens.set(token, { email, createdAt: new Date(), expiresAt: new Date(Date.now() + 3600000) });
  
  // Send email if transporter is configured
  if (transporter) {
    try {
      const verifyUrl = `${process.env.DOMAIN || 'https://bloknotservis.ru'}/auth/magic-link?token=${token}`;
      
      await transporter.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
        to: email,
        subject: 'Bloknot - Ссылка для входа',
        html: `
          <h2>Добро пожаловать в Bloknot!</h2>
          <p>Нажмите на ссылку ниже, чтобы войти в свой аккаунт:</p>
          <p><a href="${verifyUrl}">Войти в аккаунт</a></p>
          <p>Если вы не запрашивали эту ссылку, просто проигнорируйте это письмо.</p>
          <p>Ссылка действительна в течение 1 часа.</p>
        `
      });
      
      console.log('Email sent to:', email);
    } catch (error) {
      console.error('Email sending error:', error);
    }
  } else {
    console.log('Email not sent - transporter not configured');
    console.log('Login link for', email, ':', `${process.env.DOMAIN || 'https://bloknotservis.ru'}/auth/magic-link?token=${token}`);
  }
  
  res.json({
    success: true,
    message: "Login link sent",
    verifyUrl: `${process.env.DOMAIN || 'https://bloknotservis.ru'}/auth/magic-link?token=${token}`
  });
});

// GET /api/auth/magic/:token
router.get('/magic/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    const tokenData = memoryTokens.get(token);
    
    if (!tokenData) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }
    
    if (new Date() > tokenData.expiresAt) {
      memoryTokens.delete(token);
      return res.status(400).json({ error: "Token expired" });
    }

    const user = memoryUsers.get(tokenData.email);
    
    console.log('✅ TOKEN VERIFIED:', token, 'for email:', tokenData.email);

    res.json({ 
      success: true,
      message: "Token verified successfully",
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        businessId: user.businessId
      },
      token 
    });

  } catch (error) {
    console.error('❌ VERIFY MAGIC LINK ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const tokenData = memoryTokens.get(token);
    
    if (!tokenData || new Date() > tokenData.expiresAt) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const user = memoryUsers.get(tokenData.email);
    
    res.json({ 
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        businessId: user.businessId
      }
    });

  } catch (error) {
    console.error('❌ GET USER ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      memoryTokens.delete(token);
    }
    
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('❌ LOGOUT ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /auth/verify (для фронтенда)
router.get('/verify', (req, res) => {
  console.log('🔗 VERIFY REQUEST:', req.query);
  const { token } = req.query;
  
  if (!token) {
    console.log('❌ No token provided');
    return res.status(400).json({ error: "Token required" });
  }
  
  // Проверяем токен в памяти
  const tokenData = memoryTokens.get(token);
  
  if (!tokenData) {
    console.log('❌ Invalid token:', token);
    return res.status(400).json({ error: "Invalid or expired token" });
  }
  
  if (new Date() > tokenData.expiresAt) {
    memoryTokens.delete(token);
    console.log('❌ Token expired:', token);
    return res.status(400).json({ error: "Token expired" });
  }

  const user = memoryUsers.get(tokenData.email);
  
  console.log('✅ Token verified:', token, 'for email:', tokenData.email);
  
  // Редирект на фронт с успехом
  res.redirect('/?verified=true&token=' + token);
});

module.exports = router;
