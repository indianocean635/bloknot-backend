const express = require('express');
const router = express.Router();

// Временное хранилище пользователей и токенов
const memoryUsers = new Map();
const memoryTokens = new Map();

// POST /api/auth/magic-link
router.post('/magic-link', async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    
    if (!normalizedEmail) {
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

    console.log('🔗 LOGIN LINK:', `https://bloknotservis.ru/auth/verify?token=${token}`);
    console.log('👤 User:', normalizedEmail);

    res.json({ 
      success: true,
      message: "Login link sent successfully",
      verifyUrl: `https://bloknotservis.ru/auth/verify?token=${token}`
    });

  } catch (error) {
    console.error('❌ Send magic link error:', error);
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
    console.error('❌ Verify magic link error:', error);
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
    console.error('❌ Get user error:', error);
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
    console.error('❌ Logout error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
