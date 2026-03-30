const express = require("express");
const router = express.Router();

// Временное хранилище токенов в памяти
const memoryTokens = {};

// POST /api/auth/magic-link
router.post("/magic-link", async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    
    if (!normalizedEmail) {
      return res.status(400).json({ error: "Email required" });
    }

    // Генерируем токен
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    
    // Сохраняем токен в памяти
    memoryTokens[token] = {
      email: normalizedEmail,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 часа
    };

    console.log('LOGIN LINK:', `https://bloknotservis.ru/auth/verify?token=${token}`);

    res.json({ 
      success: true,
      message: "Login link sent",
      verifyUrl: `https://bloknotservis.ru/auth/verify?token=${token}`
    });

  } catch (error) {
    console.error('Send magic link error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/magic/:token
router.get("/magic/:token", async (req, res) => {
  try {
    const { token } = req.params;
    
    const tokenData = memoryTokens[token];
    
    if (!tokenData) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }
    
    if (new Date() > tokenData.expiresAt) {
      delete memoryTokens[token];
      return res.status(400).json({ error: "Token expired" });
    }

    console.log('✅ TOKEN VERIFIED:', token, 'for email:', tokenData.email);

    res.json({ 
      success: true,
      message: "Token verified",
      email: tokenData.email,
      token 
    });

  } catch (error) {
    console.error('Verify magic link error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
