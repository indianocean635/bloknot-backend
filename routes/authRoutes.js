const express = require('express');
const nodemailer = require('nodemailer');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();

const prisma = new PrismaClient();

// Load environment variables from .env file
require('dotenv').config();

// Debug: Output S3_BUCKET to console
console.log('S3_BUCKET:', process.env.S3_BUCKET);

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

// POST /api/auth/login (password authentication)
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  console.log(`[LOGIN ATTEMPT] Email: ${email}`);
  
  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        business: true,
        ownedBusiness: true,
        staffProfile: true
      }
    });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Check if user has password
    if (!user.password) {
      return res.status(401).json({ error: 'Please use magic link to login first' });
    }
    
    // Verify password
    const bcrypt = require('bcrypt');
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    console.log(`[LOGIN SUCCESS] Email: ${email}`);
    
    // Generate JWT token
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );
    
    // Set authentication cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      path: '/',
    });
    
    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        businessId: user.businessId
      }
    });
    
  } catch (error) {
    console.error('[LOGIN ERROR]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/request-login moved to magicLinkRoutes.js to avoid conflicts

// POST /api/auth/send-link (alias for compatibility)
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
    const jwt = require('jsonwebtoken');

    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({ error: 'No token' });
    }

    let payload;

    try {
      payload = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { business: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    res.json({ 
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        businessId: user.businessId,
        requiresPassword: !user.password
      }
    });
  } catch (error) {
    console.error('GET USER ERROR:', error);
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
    console.error('LOGOUT ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /auth/verify (frontend)
router.get('/verify', async (req, res) => {
  try {
    console.log('VERIFY REQUEST:', req.query);
    const { token } = req.query;
    
    if (!token) {
      console.log('No token provided');
      return res.status(400).json({ error: "Token required" });
    }
    
    // Check token in memory
    const tokenData = memoryTokens.get(token);
    
    if (!tokenData) {
      console.log('Invalid token:', token);
      return res.status(400).json({ error: "Invalid or expired token" });
    }
    
    if (new Date() > tokenData.expiresAt) {
      memoryTokens.delete(token);
      console.log('Token expired:', token);
      return res.status(400).json({ error: "Token expired" });
    }

    // Find real user in database using email from token
    const realUser = await prisma.user.findUnique({
      where: { email: tokenData.email },
      include: { business: true }
    });
    
    if (!realUser) {
      console.log('User not found in database:', tokenData.email);
      return res.status(400).json({ error: "User not found" });
    }
    
    console.log('Token verified:', token, 'for email:', tokenData.email, 'real user:', realUser.email);
    
    // Redirect to frontend with success
    res.redirect('/?verified=true&token=' + token);
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /auth/update-profile
router.post('/update-profile', async (req, res) => {
  try {
    const { name } = req.body;
    
    const jwt = require('jsonwebtoken');

    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({ error: 'No token' });
    }

    let payload;

    try {
      payload = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Find user in database
    const user = await prisma.user.findUnique({
      where: { id: payload.userId }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update user name
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { name: name || null }
    });
    
    console.log(`[AUTH] Profile updated for user: ${userEmail}, name: ${name}`);
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
