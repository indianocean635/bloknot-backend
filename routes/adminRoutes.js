const express = require('express');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();

const prisma = new PrismaClient();

// Get admin stats
router.get('/stats', async (req, res) => {
  try {
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
router.get('/users', async (req, res) => {
  try {
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

    const usersWithStaff = users.map(user => ({
      id: user.id,
      email: user.email,
      phone: user.phone,
      createdAt: user.createdAt,
      isPaying: user.isPaying,
      totalPaid: user.totalPaid,
      nextBillingAt: user.nextBillingAt,
      staffUsers: user.business?.users || []
    }));

    res.json(usersWithStaff);
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user
router.patch('/users/:id', async (req, res) => {
  try {
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
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.user.delete({
      where: { id }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Impersonate user
router.get('/impersonate/:id', async (req, res) => {
  try {
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
  
    // Set impersonation session
    res.cookie('impersonate', user.email, { maxAge: 3600000 }); // 1 hour
    res.redirect('/dashboard.html?logged=1');
  } catch (error) {
    console.error('Admin impersonate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Return from impersonation
router.get('/return', (req, res) => {
  res.clearCookie('impersonate');
  res.redirect('/admin.html');
});

module.exports = router;
