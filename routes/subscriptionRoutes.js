const express = require("express");
const jwt = require('jsonwebtoken');
const { 
  getSubscription, 
  createSubscription, 
  getPlans 
} = require("../controllers/subscriptionController");
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const router = express.Router();

// JWT authentication middleware
const requireAuth = async (req, res, next) => {
  try {
    const token = req.cookies?.auth || req.headers?.authorization?.replace('Bearer ', '');
    
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

// Get current subscription
router.get("/subscription", requireAuth, getSubscription);

// Create or update subscription
router.post("/subscription", requireAuth, createSubscription);

// Get available plans
router.get("/plans", requireAuth, getPlans);

module.exports = router;
