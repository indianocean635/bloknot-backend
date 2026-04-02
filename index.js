const express = require('express');
const path = require('path');
const fs = require('fs');
const authRoutes = require('./routes/authRoutes');
const app = express();
const PORT = 3001;

// Создаем необходимые папки
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.mkdirSync(path.join(uploadsDir, 'avatars'), { recursive: true });
  fs.mkdirSync(path.join(uploadsDir, 'works'), { recursive: true });
}

app.use(express.json());

// API routes
app.use('/api/auth', authRoutes);

// Health check
app.get('/health', (req, res) => {
  console.log('Health check received');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Static files
app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`🚀 MINIMAL SERVER running on port ${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`🔐 Auth: http://localhost:${PORT}/api/auth/magic-link`);
  console.log(`🔐 Verify: http://localhost:${PORT}/auth/verify?token=TOKEN`);
});
