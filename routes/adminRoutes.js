const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAuth } = require('../middleware/authMiddleware');
const router = express.Router();

const prisma = new PrismaClient();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../public');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, 'admin-custom-image.' + file.originalname.split('.').pop());
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Get admin stats
router.get('/stats', requireAuth, async (req, res) => {
  try {
    console.log('[REQUEST]', {
      userId: req.user?.id,
      businessId: req.user?.businessId,
      route: req.originalUrl
    });

    // Admin endpoints don't require businessId filtering as they are for super admin
    // but we still need authentication check
    if (!req.user || req.user.role !== 'SUPER_ADMIN') {
      console.warn('[SECURITY] Unauthorized admin access attempt', { userId: req.user?.id });
      return res.status(403).json({ error: 'Forbidden - Admin access required' });
    }

    const users = await prisma.user.findMany({
      where: { role: 'OWNER' },
      include: {
        staffProfile: true,
        business: {
          include: {
            users: {
              where: { role: 'STAFF' }
            }
          }
        }
      }
    });

    const stats = {
      totalUsers: users.length,
      payingUsers: users.filter(u => u.isPaying).length,
      totalPaid: users.reduce((sum, u) => sum + u.totalPaid, 0)
    };
    res.json(stats);
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all users
router.get('/users', requireAuth, async (req, res) => {
  try {
    console.log('[REQUEST]', {
      userId: req.user?.id,
      businessId: req.user?.businessId,
      route: req.originalUrl
    });

    // Admin authentication check
    if (!req.user || req.user.role !== 'SUPER_ADMIN') {
      console.warn('[SECURITY] Unauthorized admin access attempt', { userId: req.user?.id });
      return res.status(403).json({ error: 'Forbidden - Admin access required' });
    }

    const users = await prisma.user.findMany({
      where: { role: 'OWNER' },
      include: {
        business: {
          include: {
            users: {
              where: { role: 'STAFF' },
              select: {
                id: true,
                email: true,
                phone: true,
                createdAt: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Add password status to each user
    const usersWithPassword = users.map(user => ({
      ...user,
      password: user.password ? '***' : null,
      hasPassword: !!user.password
    }));

    const usersWithStaff = usersWithPassword.map(user => ({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      createdAt: user.createdAt,
      isPaying: user.isPaying,
      totalPaid: user.totalPaid,
      nextBillingAt: user.nextBillingAt,
      password: user.password,
      hasPassword: user.hasPassword,
      staffUsers: user.business?.users || []
    }));

    res.json(usersWithStaff);
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single user
router.get('/users/:id', requireAuth, async (req, res) => {
  try {
    console.log('[REQUEST]', {
      userId: req.user?.id,
      businessId: req.user?.businessId,
      route: req.originalUrl
    });

    // Admin authentication check
    if (!req.user || req.user.role !== 'SUPER_ADMIN') {
      console.warn('[SECURITY] Unauthorized admin access attempt', { userId: req.user?.id });
      return res.status(403).json({ error: 'Forbidden - Admin access required' });
    }

    const { id } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        business: true
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Return user with password (for admin copying)
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      createdAt: user.createdAt,
      password: user.password, // Include actual password for admin
      hasPassword: !!user.password
    });
  } catch (error) {
    console.error('Admin get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user
router.patch('/users/:id', requireAuth, async (req, res) => {
  try {
    console.log('[REQUEST]', {
      userId: req.user?.id,
      businessId: req.user?.businessId,
      route: req.originalUrl
    });

    // Admin authentication check
    if (!req.user || req.user.role !== 'SUPER_ADMIN') {
      console.warn('[SECURITY] Unauthorized admin access attempt', { userId: req.user?.id });
      return res.status(403).json({ error: 'Forbidden - Admin access required' });
    }

    const { id } = req.params;
    const { isPaying, totalPaid, nextBillingAt } = req.body;
    
    const updateData = {};
    if (isPaying !== undefined) updateData.isPaying = isPaying;
    if (totalPaid !== undefined) updateData.totalPaid = Number(totalPaid);
    if (nextBillingAt !== undefined) updateData.nextBillingAt = nextBillingAt ? new Date(nextBillingAt) : null;
    
    const user = await prisma.user.update({
      where: { id },
      data: updateData
    });
    
    res.json(user);
  } catch (error) {
    console.error('Admin update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user
router.delete('/users/:id', requireAuth, async (req, res) => {
  try {
    console.log('[REQUEST]', {
      userId: req.user?.id,
      businessId: req.user?.businessId,
      route: req.originalUrl
    });

    // Admin authentication check
    if (!req.user || req.user.role !== 'SUPER_ADMIN') {
      console.warn('[SECURITY] Unauthorized admin access attempt', { userId: req.user?.id });
      return res.status(403).json({ error: 'Forbidden - Admin access required' });
    }

    const { id } = req.params;
    console.log(`[ADMIN DELETE] Attempting to delete user: ${id}`);
    
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id },
      include: { 
        ownedBusiness: true,
        business: true,
        staffProfile: true,
        loginTokens: true
      }
    });
    
    if (!user) {
      console.log(`[ADMIN DELETE] User not found: ${id}`);
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log(`[ADMIN DELETE] Found user:`, {
      email: user.email,
      hasBusiness: !!user.ownedBusiness,
      hasStaffProfile: !!user.staffProfile,
      loginTokensCount: user.loginTokens.length
    });
    
    // Check if user owns a business
    if (user.ownedBusiness) {
      console.log(`[ADMIN DELETE] User owns business: ${user.ownedBusiness.id}`);
      return res.status(400).json({ 
        error: 'USER_OWNS_BUSINESS',
        message: 'User owns a business',
        businessId: user.ownedBusiness.id
      });
    }
    
    // Delete related data first
    console.log(`[ADMIN DELETE] Deleting login tokens for user: ${id}`);
    await prisma.loginToken.deleteMany({
      where: { userId: id }
    });
    
    if (user.staffProfile) {
      console.log(`[ADMIN DELETE] Deleting staff profile for user: ${id}`);
      await prisma.staff.delete({
        where: { userId: id }
      });
    }
    
    // Delete the user
    console.log(`[ADMIN DELETE] Deleting user: ${id}`);
    await prisma.user.delete({
      where: { id }
    });
    
    console.log(`[ADMIN DELETE] Successfully deleted user: ${id}`);
    res.json({ success: true });
  } catch (error) {
    console.error('[ADMIN DELETE] Error:', error);
    console.error('[ADMIN DELETE] Error details:', {
      code: error.code,
      message: error.message,
      meta: error.meta
    });
    
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Cannot delete user - related data exists' });
    } else if (error.code === 'P2025') {
      res.status(404).json({ error: 'User not found' });
    } else if (error.code === 'P2003') {
      res.status(400).json({ error: 'Cannot delete user - foreign key constraint' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Force delete user (with business)
router.delete('/users/:id/force', requireAuth, async (req, res) => {
  try {
    console.log('[REQUEST]', {
      userId: req.user?.id,
      businessId: req.user?.businessId,
      route: req.originalUrl
    });

    // Admin authentication check
    if (!req.user || req.user.role !== 'SUPER_ADMIN') {
      console.warn('[SECURITY] Unauthorized admin access attempt', { userId: req.user?.id });
      return res.status(403).json({ error: 'Forbidden - Admin access required' });
    }

    const { id } = req.params;
    console.log(`[ADMIN FORCE DELETE] Attempting to force delete user: ${id}`);
    
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id },
      include: { 
        ownedBusiness: true,
        business: true,
        staffProfile: true,
        loginTokens: true
      }
    });
    
    if (!user) {
      console.log(`[ADMIN FORCE DELETE] User not found: ${id}`);
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log(`[ADMIN FORCE DELETE] Found user:`, {
      email: user.email,
      hasBusiness: !!user.ownedBusiness,
      hasStaffProfile: !!user.staffProfile,
      loginTokensCount: user.loginTokens.length
    });
    
    // Use transaction for safe deletion
    const result = await prisma.$transaction(async (tx) => {
      console.log(`[ADMIN FORCE DELETE] Starting transaction for user: ${id}`);
      
      // Delete login tokens
      console.log(`[ADMIN FORCE DELETE] Deleting login tokens for user: ${id}`);
      await tx.loginToken.deleteMany({
        where: { userId: id }
      });
      
      // Delete staff profile if exists
      if (user.staffProfile) {
        console.log(`[ADMIN FORCE DELETE] Deleting staff profile for user: ${id}`);
        await tx.staff.delete({
          where: { userId: id }
        });
      }
      
      // Delete business if user owns one
      if (user.ownedBusiness) {
        console.log(`[ADMIN FORCE DELETE] Deleting business: ${user.ownedBusiness.id}`);
        
        // Delete business-related data (cascade should handle most, but be explicit)
        const businessId = user.ownedBusiness.id;
        
        // Delete branches
        await tx.branch.deleteMany({
          where: { businessId }
        });
        
        // Delete services
        await tx.service.deleteMany({
          where: { businessId }
        });
        
        // Delete categories
        await tx.category.deleteMany({
          where: { businessId }
        });
        
        // Delete masters
        await tx.master.deleteMany({
          where: { businessId }
        });
        
        // Delete work photos
        await tx.workPhoto.deleteMany({
          where: { businessId }
        });
        
        // Delete settings
        await tx.settings.deleteMany({
          where: { businessId }
        });
        
        // Delete staff invites
        await tx.staffInvite.deleteMany({
          where: { businessId }
        });
        
        // Delete appointments
        await tx.appointment.deleteMany({
          where: { businessId }
        });
        
        // Delete schedules
        await tx.schedule.deleteMany({
          where: { businessId }
        });
        
        // Delete subscriptions
        await tx.subscription.deleteMany({
          where: { businessId }
        });
        
        // Update other users' businessId to null if they reference this business
        await tx.user.updateMany({
          where: { businessId },
          data: { businessId: null }
        });
        
        // Delete the business
        await tx.business.delete({
          where: { id: businessId }
        });
        
        console.log(`[ADMIN FORCE DELETE] Successfully deleted business: ${businessId}`);
      }
      
      // Delete the user
      console.log(`[ADMIN FORCE DELETE] Deleting user: ${id}`);
      const deletedUser = await tx.user.delete({
        where: { id }
      });
      
      console.log(`[ADMIN FORCE DELETE] Successfully deleted user: ${id}`);
      return deletedUser;
    });
    
    console.log(`[ADMIN FORCE DELETE] Transaction completed successfully`);
    res.json({ success: true });
    
  } catch (error) {
    console.error('[ADMIN FORCE DELETE] Error:', error);
    console.error('[ADMIN FORCE DELETE] Error details:', {
      code: error.code,
      message: error.message,
      meta: error.meta
    });
    
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Cannot delete user - related data exists' });
    } else if (error.code === 'P2025') {
      res.status(404).json({ error: 'User not found' });
    } else if (error.code === 'P2003') {
      res.status(400).json({ error: 'Cannot delete user - foreign key constraint' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Impersonate user
router.get('/impersonate/:id', requireAuth, async (req, res) => {
  try {
    console.log('[REQUEST]', {
      userId: req.user?.id,
      businessId: req.user?.businessId,
      route: req.originalUrl
    });

    // Admin authentication check
    if (!req.user || req.user.role !== 'SUPER_ADMIN') {
      console.warn('[SECURITY] Unauthorized admin access attempt', { userId: req.user?.id });
      return res.status(403).json({ error: 'Forbidden - Admin access required' });
    }

    const { id } = req.params;
    console.log(`[ADMIN IMPERSONATE] Starting impersonation for user ID: ${id}`);
    
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        business: true
      }
    });
    
    console.log(`[ADMIN IMPERSONATE] User found:`, user ? { id: user.id, email: user.email, name: user.name } : null);
    
    if (!user) {
      console.log(`[ADMIN IMPERSONATE] User not found for ID: ${id}`);
      return res.status(404).json({ error: 'User not found' });
    }
  
    // Set impersonation session
    console.log(`[ADMIN IMPERSONATE] Setting cookie for: ${user.email}`);
    res.cookie('impersonate', user.email, { maxAge: 3600000 }); // 1 hour
    console.log(`[ADMIN IMPERSONATE] Redirecting to dashboard.html?logged=1&v=20260420-1`);
    res.redirect('/dashboard.html?logged=1&v=20260420-1');
  } catch (error) {
    console.error('Admin impersonate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset user password
router.post('/users/:id/reset-password', requireAuth, async (req, res) => {
  try {
    console.log('[REQUEST]', {
      userId: req.user?.id,
      businessId: req.user?.businessId,
      route: req.originalUrl
    });

    // Admin authentication check
    if (!req.user || req.user.role !== 'SUPER_ADMIN') {
      console.warn('[SECURITY] Unauthorized admin access attempt', { userId: req.user?.id });
      return res.status(403).json({ error: 'Forbidden - Admin access required' });
    }

    const { id } = req.params;
    const { password } = req.body;
    
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Update user password
    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword }
    });
    
    console.log(`[ADMIN] Password reset for user: ${id}`);
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Admin password reset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload admin image
router.post('/upload-image', requireAuth, upload.single('image'), (req, res) => {
  try {
    console.log('[REQUEST]', {
      userId: req.user?.id,
      businessId: req.user?.businessId,
      route: req.originalUrl
    });

    // Admin authentication check
    if (!req.user || req.user.role !== 'SUPER_ADMIN') {
      console.warn('[SECURITY] Unauthorized admin access attempt', { userId: req.user?.id });
      return res.status(403).json({ error: 'Forbidden - Admin access required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    console.log(`[ADMIN] Image uploaded: ${req.file.filename}`);
    
    // Return the actual filename with extension
    const imageUrl = '/admin-custom-image.' + req.file.originalname.split('.').pop();
    
    res.json({
      success: true,
      imageUrl: imageUrl,
      filename: req.file.filename,
      message: 'Image uploaded successfully'
    });
  } catch (error) {
    console.error('Admin image upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Reset admin image
router.delete('/reset-image', requireAuth, (req, res) => {
  try {
    console.log('[REQUEST]', {
      userId: req.user?.id,
      businessId: req.user?.businessId,
      route: req.originalUrl
    });

    // Admin authentication check
    if (!req.user || req.user.role !== 'SUPER_ADMIN') {
      console.warn('[SECURITY] Unauthorized admin access attempt', { userId: req.user?.id });
      return res.status(403).json({ error: 'Forbidden - Admin access required' });
    }

    const publicDir = path.join(__dirname, '../public');
    
    // Delete all possible admin-custom-image files
    const extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    
    extensions.forEach(ext => {
      const imagePath = path.join(publicDir, `admin-custom-image.${ext}`);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
        console.log(`[ADMIN] Custom image deleted: admin-custom-image.${ext}`);
      }
    });
    
    res.json({
      success: true,
      message: 'Image reset successfully'
    });
  } catch (error) {
    console.error('Admin image reset error:', error);
    res.status(500).json({ error: 'Reset failed' });
  }
});

// Admin login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find super admin user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user || user.role !== 'SUPER_ADMIN') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '90d' }
    );

    // Set JWT cookie
    res.cookie('auth', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      path: '/',
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Return from impersonation
router.get('/return', requireAuth, (req, res) => {
  res.clearCookie('impersonate');
  res.redirect('/admin.html');
});

module.exports = router;
