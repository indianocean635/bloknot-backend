const express = require('express');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const businessRoutes = require('./routes/businessRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const magicLinkRoutes = require('./routes/magicLinkRoutes');
const { requireMagicAuth, getBusinessFromUser, adminAuth, optionalAuth } = require('./middleware/magicAuthMiddleware');
const app = express();
const PORT = 3001;
const prisma = new PrismaClient();

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

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminAuth, adminRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/auth', magicLinkRoutes);

console.log('Business routes loaded:', typeof businessRoutes);
console.log('Business routes methods:', Object.getOwnPropertyNames(businessRoutes));

// Health check
app.get('/health', (req, res) => {
  console.log('Health check received');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API version endpoint
app.get('/api/version', (req, res) => {
  res.json({ version: '1.0.0' });
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

// Auth confirm endpoint (for magic links)
app.get('/auth/confirm', async (req, res) => {
  const token = req.query.token;

  if (!token) {
    return res.status(400).send("No token");
  }

  console.log("AUTH CONFIRM TOKEN:", token);

  try {
    // Find the login token
    const loginToken = await prisma.loginToken.findFirst({
      where: {
        token: token,
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        user: true
      }
    });

    if (!loginToken) {
      return res.status(400).send("Invalid or expired token");
    }

    console.log("AUTH CONFIRM USER FOUND:", loginToken.user.email);

    // Delete the used token
    await prisma.loginToken.delete({
      where: { id: loginToken.id }
    });

    // Create HTML page that sets localStorage and redirects
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Auth Confirm</title>
    <script>
        // Set localStorage data
        localStorage.setItem('bloknot_logged_in_email', '${loginToken.user.email}');
        localStorage.setItem('bloknot_user_id', '${loginToken.user.id}');
        localStorage.setItem('bloknot_business_id', '${loginToken.user.businessId || ''}');
        localStorage.setItem('bloknot_logged_in', '1');
        localStorage.setItem('bloknot_user_email', '${loginToken.user.email}');
        
        console.log('localStorage set for user:', '${loginToken.user.email}');
        
        // Redirect to dashboard
        window.location.href = '/dashboard.html';
    </script>
</head>
<body>
    <p>Redirecting to dashboard...</p>
</body>
</html>
    `;

    res.send(html);
  } catch (error) {
    console.error("AUTH CONFIRM ERROR:", error);
    res.status(500).send("Server error");
  }
});

// Static files (в самом конце!)
app.use(express.static('public'));

// 404 fallback (в самом конце!)
app.use((req, res) => {
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
