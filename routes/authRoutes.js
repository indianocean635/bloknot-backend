const express = require('express');
const nodemailer = require('nodemailer');
const router = express.Router();

// Временное хранилище пользователей и токенов
const memoryUsers = new Map();
const memoryTokens = new Map();

// Email transporter (если настроен SMTP)
let transporter = null;

// Инициализация nodemailer если есть SMTP настройки
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  console.log('📧 Email transporter configured');
} else {
  console.log('📧 Email not configured - using console logs only');
}

// POST /api/auth/magic-link
router.post('/magic-link', async (req, res) => {
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
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 часа
    });

    // Формируем полную ссылку для входа
    const fullLink = `https://bloknotservis.ru/auth/verify?token=${token}`;
    
    console.log('🔗 LOGIN LINK:', fullLink);
    console.log('👤 User:', normalizedEmail);
    console.log('✅ MAGIC-LINK RESPONSE SENT');

    // Отправка email если настроен transporter
    if (transporter) {
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || '"Bloknot" <no-reply@bloknotservis.ru>',
          to: normalizedEmail,
          subject: 'Вход в Bloknot',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #4c6fff;">Вход в Bloknot</h2>
              <p>Здравствуйте! Вы запросили вход в систему Bloknot.</p>
              <p>Для входа нажмите на кнопку ниже:</p>
              <a href="${fullLink}" style="background: #4c6fff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 16px 0;">
                Войти в систему
              </a>
              <p>Или скопируйте ссылку:</p>
              <p style="background: #f4f4f4; padding: 8px; border-radius: 4px; word-break: break-all;">
                ${fullLink}
              </p>
              <p style="color: #666; font-size: 14px;">Ссылка действительна 24 часа.</p>
            </div>
          `
        });
        console.log('📧 Email sent successfully to:', normalizedEmail);
      } catch (emailError) {
        console.error('📧 Email send error:', emailError);
        // Продолжаем даже если email не отправился
      }
    } else {
      console.log('📧 Email not sent - SMTP not configured');
    }

    res.json({ 
      success: true,
      message: "Login link sent successfully",
      verifyUrl: fullLink
    });

  } catch (error) {
    console.error('❌ MAGIC-LINK ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
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
