const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

// Request magic link
async function requestLogin(req, res) {
  try {
    const { email, phone, name, password } = req.body;
    
    console.log(`[MAGIC LINK] Request login for email: ${email}, phone: ${phone}, name: ${name}`);
    console.log(`[MAGIC LINK] Full request body:`, req.body);
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email },
      include: { business: true }
    });
    
    console.log(`[MAGIC LINK] Found user:`, user ? { id: user.id, email: user.email, name: user.name, phone: user.phone } : null);

    if (!user) {
      // Create new user with business
      try {
        const timestamp = Date.now();
        const slug = `${email.toLowerCase().replace('@', '-').replace('.', '-')}-${timestamp}`;
        
        // Create business with owner
        const business = await prisma.business.create({
          data: {
            name: `${email}'s Business`,
            slug: slug,
            createdAt: new Date(),
            updatedAt: new Date(),
            owner: {
              create: {
                email,
                phone: phone || null,
                name: name || null,
                role: 'OWNER',
                createdAt: new Date(),
                ...(password && {
                  password: await bcrypt.hash(password, 10)
                })
              }
            }
          },
          include: { owner: true }
        });
        
        user = business.owner;
        
        // Установить businessId для пользователя
        await prisma.user.update({
          where: { id: user.id },
          data: { businessId: business.id }
        });
        
        // Получить обновленного пользователя с бизнес данными
        user = await prisma.user.findUnique({
          where: { id: user.id },
          include: { business: true }
        });
        
        console.log(`[MAGIC LINK] Created new user with business: ${email}`);
        console.log(`[MAGIC LINK] Business ID: ${business.id}, User ID: ${user.id}, User BusinessId: ${user.businessId}`);
        
        if (password) {
          console.log(`[MAGIC LINK] New user with password: ${email}`);
        }
      } catch (createError) {
        console.error(`[MAGIC LINK] Failed to create user ${email}:`, createError);
        throw createError;
      }
    } else {
      // Update existing user with new data if provided
      const updateData = {};
      
      // Always update if new data is provided and it's different from current
      if (phone && (!user.phone || phone !== user.phone)) {
        updateData.phone = phone;
      }
      
      if (name && (!user.name || name !== user.name)) {
        updateData.name = name;
      }
      
      if (Object.keys(updateData).length > 0) {
        user = await prisma.user.update({
          where: { email },
          data: updateData,
          include: { business: true }
        });
        console.log(`[MAGIC LINK] Updated user ${email} with:`, updateData);
      }
    }

    // Generate magic link token
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Delete old tokens for this user
    await prisma.loginToken.deleteMany({
      where: { userId: user.id }
    });

    // Create new login token
    await prisma.loginToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt
      }
    });

    // Send email with magic link
    const magicLink = `https://bloknotservis.ru/auth/confirm?token=${token}`;
    
    // Configure email service
    const nodemailer = require('nodemailer');
    
    // For development, use ethereal email or test account
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.yandex.ru',
      port: process.env.SMTP_PORT || 465,
      secure: process.env.SMTP_SECURE === 'true' || true,
      auth: {
        user: process.env.SMTP_USER || 'your-yandex-email@yandex.ru',
        pass: process.env.SMTP_PASS || 'your-yandex-password'
      },
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 10000
    });
    
    // Send email with improved timeout handling
    try {
      await transporter.sendMail({
        from: `"Bloknot" <${process.env.SMTP_FROM || 'noreply@bloknotservis.ru'}>`,
        to: user.email,
        subject: '\u0412\u0430\u0448\u0430 \u0441\u0441\u044b\u043b\u043a\u0430 \u0434\u043b\u044f \u0432\u0445\u043e\u0434\u0430',
        html: `
          <h2>\u0414\u043e\u0431\u0440\u043e \u043f\u043e\u0436\u0430\u043b\u043e\u0432\u0430\u0442\u044c \u0432 Bloknot!</h2>
          <p>\u041d\u0430\u0436\u043c\u0438\u0442\u0435 \u043d\u0430 \u0441\u0441\u044b\u043b\u043a\u0443 \u043d\u0438\u0436\u0435, \u0447\u0442\u043e\u0431\u044b \u0432\u043e\u0439\u0442\u0438 \u0432 \u0441\u0432\u043e\u0439 \u0430\u043a\u043a\u0430\u0443\u043d\u0442:</p>
          <p><a href="${magicLink}">${magicLink}</a></p>
          <p>\u042d\u0442\u0430 \u0441\u0441\u044b\u043b\u043a\u0430 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0442\u0435\u043b\u044c\u043d\u0430 15 \u043c\u0438\u043d\u0443\u0442.</p>
        `
      });
      
      console.log(`[EMAIL] Magic link sent to ${user.email}`);
    } catch (emailError) {
      console.error('[EMAIL ERROR] Failed to send email:', emailError);
      console.log('[EMAIL INFO] To fix email sending, set up Yandex SMTP:');
      console.log('[EMAIL INFO] 1. Use your Yandex email account');
      console.log('[EMAIL INFO] 2. Set environment variables:');
      console.log('[EMAIL INFO]    export SMTP_HOST=smtp.yandex.ru');
      console.log('[EMAIL INFO]    export SMTP_PORT=465');
      console.log('[EMAIL INFO]    export SMTP_SECURE=true');
      console.log('[EMAIL INFO]    export SMTP_USER=your-yandex-email@yandex.ru');
      console.log('[EMAIL INFO]    export SMTP_PASS=your-yandex-password');
      console.log('[EMAIL INFO]    export SMTP_FROM="Bloknot <no-reply@bloknotservis.ru>"');
      // Continue anyway - user can still use the link from logs
      console.log(`[EMAIL] User ${user.email} can use this link to login: ${magicLink}`);
    }
    
    // Show magic link in logs for development
    console.log(`[MAGIC LINK] Generated for ${user.email}: ${magicLink}`);
    
    res.json({
      message: 'Magic link sent',
      magicLink, // Show in development for testing
      debug: true
    });

  } catch (error) {
    console.error('Request login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Confirm magic link
async function confirmLogin(req, res) {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Find valid token
    const loginToken = await prisma.loginToken.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!loginToken || loginToken.used || loginToken.expiresAt < new Date()) {
      console.log(`[AUTH] Invalid token: ${token}`, {
        found: !!loginToken,
        used: loginToken?.used,
        expired: loginToken?.expiresAt < new Date()
      });
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    // Check if user still exists
    if (!loginToken.user) {
      console.log(`[AUTH] Token references deleted user: ${token}`);
      // Clean up orphaned token
      await prisma.loginToken.delete({
        where: { id: loginToken.id }
      });
      return res.status(400).json({ error: 'User account no longer exists' });
    }

    // Mark token as used
    await prisma.loginToken.update({
      where: { id: loginToken.id },
      data: { used: true }
    });

    const user = loginToken.user;

    // Generate JWT session token (90 days)
    const jwt = require('jsonwebtoken');
    const sessionToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '90d' }
    );

    // Set JWT cookie
    res.cookie('auth', sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      path: '/',
    });

    // Check if user has password
    if (!user.password) {
      // Return JSON for frontend to handle password setup
      return res.json({
        status: 'SET_PASSWORD_REQUIRED',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role,
          businessId: user.businessId
        },
        token
      });
    }

    // User has password, return success for frontend to handle
    return res.json({
      status: 'LOGIN_SUCCESS',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        businessId: user.businessId
      }
    });

  } catch (error) {
    console.error('Confirm login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Set password
async function setPassword(req, res) {
  try {
    console.log('[REQUEST]', {
      userId: req.user?.id,
      businessId: req.user?.businessId,
      route: req.originalUrl
    });

    const user = req.user;
    
    if (!user) {
      console.warn('[SECURITY] Missing user', { userId: req.user?.id });
      return res.status(401).json({ error: 'User not found' });
    }

    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user password
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    // Return login success
    res.json({
      status: 'LOGIN_SUCCESS',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        phone: updatedUser.phone,
        role: updatedUser.role,
        businessId: updatedUser.businessId
      }
    });

  } catch (error) {
    console.error('Set password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Login with email and password
async function loginWithPassword(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user with business data
    const user = await prisma.user.findUnique({
      where: { email },
      include: { business: true }
    });

    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Return login success
    res.json({
      status: 'LOGIN_SUCCESS',
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        businessId: user.businessId
      }
    });

  } catch (error) {
    console.error('Login with password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  requestLogin,
  confirmLogin,
  setPassword,
  loginWithPassword
};
