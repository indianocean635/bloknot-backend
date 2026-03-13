console.log('=== Testing Server Startup ===');

// Test basic imports
try {
  console.log('1. Testing dotenv...');
  require("dotenv").config();
  console.log('✅ dotenv loaded');
} catch (e) {
  console.error('❌ dotenv error:', e.message);
  process.exit(1);
}

try {
  console.log('2. Testing express...');
  const express = require("express");
  console.log('✅ express loaded');
} catch (e) {
  console.error('❌ express error:', e.message);
  process.exit(1);
}

try {
  console.log('3. Testing cors...');
  const cors = require("cors");
  console.log('✅ cors loaded');
} catch (e) {
  console.error('❌ cors error:', e.message);
  process.exit(1);
}

try {
  console.log('4. Testing prisma service...');
  const { prisma } = require("./services/prismaService");
  console.log('✅ prisma service loaded');
  console.log('prisma type:', typeof prisma);
} catch (e) {
  console.error('❌ prisma service error:', e.message);
  process.exit(1);
}

try {
  console.log('5. Testing auth middleware...');
  const { requireAuth } = require("./middleware/authMiddleware");
  console.log('✅ auth middleware loaded');
} catch (e) {
  console.error('❌ auth middleware error:', e.message);
  process.exit(1);
}

try {
  console.log('6. Testing routes...');
  const publicRoutes = require("./routes/publicRoutes");
  console.log('✅ public routes loaded');
} catch (e) {
  console.error('❌ public routes error:', e.message);
  process.exit(1);
}

try {
  console.log('7. Testing auth routes...');
  const authRoutes = require("./routes/authRoutes");
  console.log('✅ auth routes loaded');
} catch (e) {
  console.error('❌ auth routes error:', e.message);
  process.exit(1);
}

try {
  console.log('8. Testing appointment routes...');
  const appointmentRoutes = require("./routes/appointmentRoutes");
  console.log('✅ appointment routes loaded');
} catch (e) {
  console.error('❌ appointment routes error:', e.message);
  process.exit(1);
}

try {
  console.log('9. Testing business routes...');
  const businessRoutes = require("./routes/businessRoutes");
  console.log('✅ business routes loaded');
} catch (e) {
  console.error('❌ business routes error:', e.message);
  process.exit(1);
}

try {
  console.log('10. Testing upload routes...');
  const uploadRoutes = require("./routes/uploadRoutes");
  console.log('✅ upload routes loaded');
} catch (e) {
  console.error('❌ upload routes error:', e.message);
  process.exit(1);
}

console.log('🎉 All imports successful!');
console.log('Now testing basic Express app creation...');

try {
  const express = require("express");
  const cors = require("cors");
  
  const app = express();
  
  app.use(cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  }));
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));
  
  console.log('✅ Express app created successfully');
  console.log('✅ Middleware configured successfully');
  
} catch (e) {
  console.error('❌ Express app creation error:', e.message);
  process.exit(1);
}

console.log('🎉 Basic server test passed!');
console.log('Now trying to start full server...');

// Try to start the actual server
try {
  require('./index.js');
  console.log('✅ Full server started successfully');
} catch (e) {
  console.error('❌ Full server startup error:', e.message);
  console.error('Stack trace:', e.stack);
  process.exit(1);
}
