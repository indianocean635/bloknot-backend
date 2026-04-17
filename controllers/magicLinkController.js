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
      // Create new user
      let userData = {
        email,
        phone: phone || null,
        name: name || null,
        role: 'OWNER'
      };
      
      // Add password if provided
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        userData.password = hashedPassword;
        console.log(`[MAGIC LINK] New user with password: ${email}`);
      }
      
      user = await prisma.user.create({
        data: userData,
        include: { business: true }
      });
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
    const magicLink = `http://bloknotservis.ru/auth/confirm?token=${token}`;
    
    // Configure email service
    const nodemailer = require('nodemailer');
    
    // For development, use ethereal email or test account
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER || 'test@ethereal.email',
        pass: process.env.SMTP_PASS || 'testpassword'
      }
    });
    
    // Send email
    try {
      await transporter.sendMail({
        from: `"Bloknot" <${process.env.SMTP_FROM || 'noreply@bloknotservis.ru'}>`,
        to: user.email,
        subject: 'Bloknot - Link for login',
        html: `
          <h2>Welcome to Bloknot!</h2>
          <p>Click the link below to login to your account:</p>
          <p><a href="${magicLink}">Login to Bloknot</a></p>
          <p>If you didn't request this link, please ignore this email.</p>
          <p>This link will expire in 15 minutes.</p>
        `
      });
      
      console.log(`[EMAIL SENT] Magic link sent to ${user.email}`);
      
      res.json({
        message: 'Magic link sent',
        magicLink: process.env.NODE_ENV === 'development' ? magicLink : undefined,
        debug: process.env.NODE_ENV === 'development'
      });
      
    } catch (emailError) {
      console.error('[EMAIL ERROR] Failed to send email:', emailError);
      
      // Fallback: show magic link in logs for development
      console.log(`[MAGIC LINK] Generated for ${user.email}: ${magicLink}`);
      
      res.json({
        message: 'Magic link sent',
        magicLink, // Show in development for testing
        debug: true
      });
    }

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
        name: user.name,
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
