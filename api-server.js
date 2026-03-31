const express = require('express');
const app = express();

// ⚠️ ВАЖНО: порт должен быть 3001 (у тебя фронт туда бьёт)
const PORT = 3001;

app.use(express.json());


// =========================
// HEALTH CHECK
// =========================
app.get('/health', (req, res) => {
  console.log('✅ API Health check received');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});


// =========================
// 🔥 ГЛАВНЫЙ РАБОЧИЙ ROUTE
// =========================
app.post('/api/auth/send-link', (req, res) => {
  console.log('🔥 SEND-LINK request:', req.body);

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email required" });
  }

  const token = 'token_' + Date.now();

  res.json({
    success: true,
    message: "Login link sent",

    // ⚠️ ВАЖНО: ОБРАТНЫЕ КАВЫЧКИ (не обычные!)
    verifyUrl: `https://bloknotservis.ru/auth/verify?token=${token}`
  });
});


// =========================
// (опционально) старые route
// =========================
app.post('/api/auth/magic-link', (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email required" });
  }

  const token = 'token_' + Date.now();

  res.json({
    success: true,
    message: "Login link sent",
    verifyUrl: `https://bloknotservis.ru/auth/verify?token=${token}`
  });
});


// =========================
// VERIFY ENDPOINT
// =========================
app.get('/auth/verify', (req, res) => {
  console.log('🔗 VERIFY REQUEST:', req.query);
  const { token } = req.query;
  
  if (!token) {
    return res.status(400).json({ error: "Token required" });
  }
  
  console.log('✅ Token verified:', token);
  res.redirect('/?verified=true');
});


// =========================
// START SERVER
// =========================
app.listen(PORT, () => {
  console.log(`🚀 API SERVER running on port ${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`🔐 Auth: http://localhost:${PORT}/api/auth/send-link`);
});