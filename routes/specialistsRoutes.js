const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Middleware to check authentication
const requireAuth = async (req, res, next) => {
  const jwt = require('jsonwebtoken');
  
  try {
    const token = req.cookies?.auth;
    
    if (!token) {
      return res.status(401).json({ error: 'No authentication token' });
    }
    
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = { id: payload.userId };
    
    // Get full user data with business
    const fullUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { business: true }
    });
    
    if (!fullUser) {
      return res.status(401).json({ error: "User not found" });
    }
    
    req.user.businessId = fullUser.businessId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// GET /api/specialists - Get all specialists for the user's business
router.get('/', requireAuth, async (req, res) => {
  try {
    // If no businessId, return empty array
    if (!req.user.businessId) {
      return res.json([]);
    }
    
    const specialists = await prisma.master.findMany({
      where: {
        businessId: req.user.businessId
      },
      orderBy: { name: 'asc' }
    });
    
    res.json(specialists);
  } catch (error) {
    console.error('Error fetching specialists:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/specialists - Create a new specialist
router.post('/', requireAuth, async (req, res) => {
  try {
    // If no businessId, return error
    if (!req.user.businessId) {
      return res.status(400).json({ error: 'No business associated with user' });
    }
    
    const { name, email, phone, schedule } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }
    
    // Check if specialist already exists for this business
    const existingSpecialist = await prisma.master.findFirst({
      where: {
        email,
        businessId: req.user.businessId
      }
    });
    
    if (existingSpecialist) {
      return res.status(400).json({ error: 'Specialist with this email already exists' });
    }
    
    const specialist = await prisma.master.create({
      data: {
        name,
        email,
        phone: phone || '',
        businessId: req.user.businessId
      }
    });
    
    res.status(201).json(specialist);
  } catch (error) {
    console.error('Error creating specialist:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/specialists/:id - Update a specialist
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, active } = req.body;
    
    // First find the specialist to ensure it belongs to the user's business
    const specialist = await prisma.master.findFirst({
      where: {
        id: parseInt(id),
        businessId: req.user.businessId
      }
    });
    
    if (!specialist) {
      return res.status(404).json({ error: 'Specialist not found' });
    }
    
    const updatedSpecialist = await prisma.master.update({
      where: { id: parseInt(id) },
      data: {
        name: name || specialist.name,
        email: email || specialist.email,
        phone: phone !== undefined ? phone : specialist.phone,
        active: active !== undefined ? active : specialist.active
      }
    });
    
    res.json(updatedSpecialist);
  } catch (error) {
    console.error('Error updating specialist:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/specialists/:id - Delete a specialist
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // First find the specialist to ensure it belongs to the user's business
    const specialist = await prisma.master.findFirst({
      where: {
        id: parseInt(id),
        businessId: req.user.businessId
      }
    });
    
    if (!specialist) {
      return res.status(404).json({ error: 'Specialist not found' });
    }
    
    await prisma.master.delete({
      where: { id: parseInt(id) }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting specialist:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/specialists/:id/schedule - Get specialist schedule
router.get('/:id/schedule', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // First find the specialist to ensure it belongs to the user's business
    const specialist = await prisma.master.findFirst({
      where: {
        id: parseInt(id),
        businessId: req.user.businessId
      }
    });
    
    if (!specialist) {
      return res.status(404).json({ error: 'Specialist not found' });
    }
    
    // For now, return empty schedule - can be extended later
    res.json({ schedule: '' });
  } catch (error) {
    console.error('Error fetching specialist schedule:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/specialists/:id/schedule - Update specialist schedule
router.post('/:id/schedule', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { schedule } = req.body;
    
    // First find the specialist to ensure it belongs to the user's business
    const specialist = await prisma.master.findFirst({
      where: {
        id: parseInt(id),
        businessId: req.user.businessId
      }
    });
    
    if (!specialist) {
      return res.status(404).json({ error: 'Specialist not found' });
    }
    
    // For now, just return success - schedule storage can be extended later
    res.json({ success: true, schedule });
  } catch (error) {
    console.error('Error updating specialist schedule:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
