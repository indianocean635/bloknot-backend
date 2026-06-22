const express = require('express');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const { PrismaClient } = require('@prisma/client');
const https = require('https');
const http = require('http');
const { getSignedUrlForFile } = require('./lib/s3');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const businessRoutes = require('./routes/businessRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const magicLinkRoutes = require('./routes/magicLinkRoutes');
const specialistsRoutes = require('./routes/specialistsRoutes');
const telegramRoutes = require('./routes/telegramRoutes');
const notificationsRoutes = require('./routes/notificationsRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const vkCommunityRoutes = require('./routes/vkCommunityRoutes');
const publicRoutes = require('./routes/publicRoutes');
const cloudPaymentsRoutes = require('./routes/cloudPaymentsRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
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
app.use(cookieParser());

// Raw body middleware для webhook подписи CloudPayments
app.use((req, res, next) => {
  let data = '';
  
  req.on('data', (chunk) => {
    data += chunk;
  });
  
  req.on('end', () => {
    req.rawBody = data;
    next();
  });
  
  req.on('error', (err) => {
    console.error('[RAW BODY MIDDLEWARE] Error:', err);
    next(err);
  });
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS middleware for mobile devices
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Import missing routes
const appointmentRoutes = require('./routes/appointmentRoutes');

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', adminAuth, adminRoutes); // Add protected routes after public ones
app.use('/api/settings', settingsRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/magic', magicLinkRoutes); // Changed from /api/auth to avoid conflict
app.use('/api/specialists', specialistsRoutes);
app.use('/api/masters', settingsRoutes); // Masters endpoints are in settingsRoutes
app.use('/api/telegram', telegramRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api', appointmentRoutes);
app.use('/api', paymentRoutes);
app.use('/api/vk-community', vkCommunityRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/cloudpayments', cloudPaymentsRoutes);
app.use('/api/invoice', invoiceRoutes);

console.log('Business routes loaded:', typeof businessRoutes);
console.log('Business routes methods:', Object.getOwnPropertyNames(businessRoutes));

// Health check
app.get('/health', (req, res) => {
  console.log('Health check received');
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Proxy endpoint for images to avoid CORS issues
app.get('/api/proxy/image', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    console.log('Proxying image:', url);

    // Extract filename from S3 URL
    const urlParts = url.split('/');
    const fileName = urlParts[urlParts.length - 1];
    console.log('Extracted filename:', fileName);

    // Generate signed URL
    const signedUrl = await getSignedUrlForFile(fileName, 3600);
    console.log('Generated signed URL:', signedUrl);

    // Fetch the image using signed URL
    https.get(signedUrl, (response) => {
      // Set CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      // Set content type
      res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');

      // Pipe the image data to the response
      response.pipe(res);
    }).on('error', (error) => {
      console.error('Error proxying image:', error);
      res.status(500).json({ error: "Failed to load image" });
    });
  } catch (error) {
    console.error("Error in proxy endpoint:", error);
    res.status(500).json({ error: "Internal server error" });
  }
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

// WhatsApp reminder scheduler
if (process.env.WHATSAPP_ENABLED === 'true') {
  const { checkAndSendReminders } = require('./services/whatsappReminderService');
  
  // Check for reminders every hour
  setInterval(() => {
    console.log('[SCHEDULER] Running WhatsApp reminder check...');
    checkAndSendReminders();
  }, 60 * 60 * 1000); // Every hour
  
  // Run once on startup
  setTimeout(() => {
    console.log('[SCHEDULER] Running initial WhatsApp reminder check...');
    checkAndSendReminders();
  }, 5000); // 5 seconds after startup
}

// VK reminder scheduler
if (process.env.VK_NOTIFICATIONS_ENABLED === 'true') {
  const { checkAndSendVKReminders } = require('./services/vkReminderService');
  
  // Check for VK reminders every hour
  setInterval(() => {
    console.log('[SCHEDULER] Running VK reminder check...');
    checkAndSendVKReminders();
  }, 60 * 60 * 1000); // Every hour
  
  // Run once on startup
  setTimeout(() => {
    console.log('[SCHEDULER] Running initial VK reminder check...');
    checkAndSendVKReminders();
  }, 10000); // 10 seconds after startup
}

// 404 fallback (в самом конце!)
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
});

// Start VK polling service - temporarily disabled due to missing VKLinkCode table
// const vkPollingService = require('./services/vkPollingService');
// vkPollingService.start();
console.log('🔇 VK Polling Service temporarily disabled');

// Start server
app.listen(PORT, () => {
  console.log(`🚀 MINIMAL SERVER running on port ${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`🔐 Auth: http://localhost:${PORT}/api/auth/magic-link`);
  console.log(`📱 VK Polling Service started (alternative to Callback API)`);
  console.log(`🔐 Send: http://localhost:${PORT}/api/auth/send-link`);
  console.log(`🔐 Verify: http://localhost:${PORT}/auth/verify?token=TOKEN`);
  console.log(`🔐 Magic: http://localhost:${PORT}/auth/magic-link?token=TOKEN`);
});
