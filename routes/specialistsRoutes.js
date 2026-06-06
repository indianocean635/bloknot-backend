const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getSignedUrlForFile } = require('../lib/s3');

// Middleware to check authentication
const requireAuth = async (req, res, next) => {
  const jwt = require('jsonwebtoken');
  
  try {
    // Check both cookie and Authorization header
    const token = req.cookies?.auth_token || req.cookies?.auth || req.headers?.authorization?.replace('Bearer ', '');
    
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
    console.log("USER ID:", req.user.id);
    console.log("BUSINESS ID:", req.user.businessId);

    // If no businessId, return empty array
    if (!req.user.businessId) {
      console.log("No businessId - returning empty array");
      return res.json([]);
    }

    const specialists = await prisma.master.findMany({
      where: {
        businessId: req.user.businessId
      },
      orderBy: { name: 'asc' }
    });

    // Generate signed URLs for avatars
    const specialistsWithSignedUrls = await Promise.all(specialists.map(async (specialist) => {
      if (specialist.avatarUrl) {
        const filename = specialist.avatarUrl.split('/').pop();
        const signedUrl = await getSignedUrlForFile(filename, 3600);
        return {
          ...specialist,
          avatarUrl: signedUrl
        };
      }
      return specialist;
    }));

    res.json(specialistsWithSignedUrls);
  } catch (error) {
    console.error('Error fetching specialists:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/specialists - Create a new specialist
router.post('/', requireAuth, async (req, res) => {
  try {
    console.log("[SPECIALIST CREATE] USER ID:", req.user.id);
    console.log("[SPECIALIST CREATE] BUSINESS ID:", req.user.businessId);
    console.log("[SPECIALIST CREATE] REQUEST BODY:", req.body);

    // If no businessId, return error
    if (!req.user.businessId) {
      console.log("[SPECIALIST CREATE] No businessId - cannot create specialist");
      return res.status(400).json({ error: 'No business associated with user' });
    }

    const { name, email, schedule } = req.body;

    if (!name) {
      console.log("[SPECIALIST CREATE] Name is required");
      return res.status(400).json({ error: 'Name is required' });
    }

    // Email is only required for STUDIO and PRO plans (not SOLO)
    // Check subscription to determine if email is required
    const subscription = await prisma.subscription.findUnique({
      where: { businessId: req.user.businessId }
    });

    console.log("[SPECIALIST CREATE] SUBSCRIPTION:", subscription);
    
    // If no subscription or SOLO plan, email is not required
    const isSoloPlan = !subscription || subscription.plan === 'SOLO';
    
    console.log("[SPECIALIST CREATE] IS SOLO PLAN:", isSoloPlan);
    console.log("[SPECIALIST CREATE] EMAIL PROVIDED:", email);

    if (!isSoloPlan && !email) {
      console.log("[SPECIALIST CREATE] Email is required for this plan");
      return res.status(400).json({ error: 'Email is required for this plan' });
    }

    // Check if specialist already exists for this business (only if email is provided)
    if (email) {
      const existingSpecialist = await prisma.master.findFirst({
        where: {
          email,
          businessId: req.user.businessId
        }
      });

      if (existingSpecialist) {
        return res.status(400).json({ error: 'Specialist with this email already exists' });
      }
    }

    const specialist = await prisma.master.create({
      data: {
        name,
        email: email || null, // Allow null email for SOLO plan
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
    const { name, email, active } = req.body;
    
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
      },
      include: {
        appointments: true
      }
    });
    
    if (!specialist) {
      return res.status(404).json({ error: 'Specialist not found' });
    }
    
    // Delete all appointments associated with this specialist
    if (specialist.appointments.length > 0) {
      await prisma.appointment.deleteMany({
        where: { masterId: parseInt(id) }
      });
    }
    
    // Delete the specialist
    await prisma.master.delete({
      where: { id: parseInt(id) }
    });
    
    res.json({ 
      success: true,
      deletedAppointments: specialist.appointments.length
    });
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
    
    // Return the schedule from the master model
    res.json({ schedule: specialist.schedule || {} });
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

    // Update the specialist's schedule
    const updatedSpecialist = await prisma.master.update({
      where: { id: parseInt(id) },
      data: { schedule: schedule || {} }
    });

    res.json({ success: true, schedule: updatedSpecialist.schedule });
  } catch (error) {
    console.error('Error updating specialist schedule:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/specialists/:id/settings - Get specialist settings
router.get('/:id/settings', requireAuth, async (req, res) => {
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

    res.json({
      branchId: specialist.branchId,
      schedule: specialist.schedule,
      categoryIds: specialist.categoryIds || [],
      serviceIds: specialist.serviceIds || []
    });
  } catch (error) {
    console.error('Error fetching specialist settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/specialists/:id/settings - Update specialist settings
router.post('/:id/settings', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { branchId, schedule, categoryIds, serviceIds } = req.body;

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

    // Validate branchId if provided
    if (branchId) {
      const branch = await prisma.branch.findFirst({
        where: {
          id: parseInt(branchId),
          businessId: req.user.businessId
        }
      });

      if (!branch) {
        return res.status(400).json({ error: 'Invalid branch' });
      }
    }

    // Build update data object - only update fields that are provided
    const updateData = {};
    
    if (branchId !== undefined) {
      updateData.branchId = branchId ? parseInt(branchId) : null;
    }
    
    // Only update schedule if it's provided and not empty
    // This prevents clearing existing schedule when only updating other settings
    if (schedule && Object.keys(schedule).length > 0) {
      updateData.schedule = schedule;
    }
    
    if (categoryIds !== undefined) {
      updateData.categoryIds = categoryIds ? categoryIds.map(id => parseInt(id)) : [];
    }
    
    if (serviceIds !== undefined) {
      updateData.serviceIds = serviceIds ? serviceIds.map(id => parseInt(id)) : [];
    }

    // Update specialist settings with only the provided fields
    const updatedSpecialist = await prisma.master.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    res.json({
      success: true,
      branchId: updatedSpecialist.branchId,
      schedule: updatedSpecialist.schedule,
      categoryIds: updatedSpecialist.categoryIds,
      serviceIds: updatedSpecialist.serviceIds
    });
  } catch (error) {
    console.error('Error updating specialist settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
