const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

// Request magic link
async function requestLogin(req, res) {
  try {
    const { email, phone } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email },
      include: { business: true }
    });

    if (!user) {
      // Create new user
      user = await prisma.user.create({
        data: {
          email,
          phone: phone || null,
          role: 'OWNER'
        },
        include: { business: true }
      });
    } else if (phone && !user.phone) {
      // Update phone if provided and not set
      user = await prisma.user.update({
        where: { email },
        data: { phone },
        include: { business: true }
      });
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

    // In production, send email with magic link
    // For now, return the link directly
    const magicLink = `${req.protocol}://${req.get('host')}/api/auth/confirm?token=${token}`;

    res.json({
      message: 'Magic link sent',
      magicLink, // Remove this in production
      debug: true // Remove this in production
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
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    // Mark token as used
    await prisma.loginToken.update({
      where: { id: loginToken.id },
      data: { used: true }
    });

    const user = loginToken.user;

    // Check if user has password
    if (!user.password) {
      // Always redirect to frontend for password setup
      return res.redirect(`/auth-confirm.html?token=${token}`);
    }

    // User has password, create session and redirect
    res.cookie('bloknot_logged_in_email', user.email, { maxAge: 24 * 60 * 60 * 1000 });
    res.cookie('bloknot_user_id', user.id, { maxAge: 24 * 60 * 60 * 1000 });
    res.cookie('bloknot_business_id', user.businessId || '', { maxAge: 24 * 60 * 60 * 1000 });
    res.cookie('bloknot_logged_in', '1', { maxAge: 24 * 60 * 60 * 1000 });
    return res.redirect('/dashboard.html');

  } catch (error) {
    console.error('Confirm login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Set password
async function setPassword(req, res) {
  try {
    const { userId, password } = req.body;

    if (!userId || !password) {
      return res.status(400).json({ error: 'User ID and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user password
    const user = await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

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

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
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
