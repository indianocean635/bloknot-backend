const express = require('express');
const path = require('path');
const fs = require('fs');
const authRoutes = require('./routes/authRoutes');
const app = express();
const PORT = 3001;

console.log('🔥 AuthRoutes loaded:', typeof authRoutes);
console.log('🔥 AuthRoutes methods:', Object.getOwnPropertyNames(authRoutes));

// Создаем необходимые папки
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.mkdirSync(path.join(uploadsDir, 'avatars'), { recursive: true });
  fs.mkdirSync(path.join(uploadsDir, 'works'), { recursive: true });
}

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Отладка middleware
app.use((req, res, next) => {
  console.log('🔥 REQUEST:', req.method, req.originalUrl);
  console.log('🔥 HEADERS:', req.headers);
  next();
});

// API routes
app.use('/api/auth', authRoutes);

console.log('🔥 AUTH ROUTES MOUNTED at /api/auth');

// Тестовый маршрут для проверки
app.post('/api/test', (req, res) => {
  console.log('🔥 TEST ROUTE HIT');
  res.json({ success: true, message: 'Test route works' });
});

// Тестовый маршрут без JSON
app.post('/api/simple', (req, res) => {
  console.log('🔥 SIMPLE ROUTE HIT');
  res.json({ success: true, message: 'Simple route works' });
});

// Health check
app.get('/health', (req, res) => {
  console.log('Health check received');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Verify endpoint for magic links
app.get('/auth/verify', (req, res) => {
  const token = req.query.token;
  console.log("VERIFY TOKEN:", token);

  if (!token) {
    return res.status(400).send("No token");
  }

  return res.redirect('/dashboard.html');
});

// Magic link endpoint (для совместимости)
app.get('/auth/magic-link', (req, res) => {
  const token = req.query.token;

  if (!token) {
    return res.status(400).send("No token");
  }

  console.log("MAGIC LOGIN TOKEN:", token);

  return res.redirect('/dashboard.html');
});

// Static files (в самом конце!)
app.use(express.static('public'));

// 404 fallback (в самом конце!)
app.use((req, res) => {
  console.log('🔥 404 FALLBACK:', req.method, req.originalUrl);
  console.log('🔥 404 HEADERS:', req.headers);
  console.log('🔥 404 BODY:', req.body);
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 MINIMAL SERVER running on port ${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`🔐 Auth: http://localhost:${PORT}/api/auth/magic-link`);
  console.log(`🔐 Send: http://localhost:${PORT}/api/auth/send-link`);
  console.log(`🔐 Verify: http://localhost:${PORT}/auth/verify?token=TOKEN`);
  console.log(`🔐 Magic: http://localhost:${PORT}/auth/magic-link?token=TOKEN`);
});
