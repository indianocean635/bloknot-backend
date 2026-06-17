const express = require("express");
const jwt = require('jsonwebtoken');
const { 
  createPayment, 
  handleCloudPaymentsWebhook 
} = require("../controllers/paymentController");
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const router = express.Router();

// JWT authentication middleware
const requireAuth = async (req, res, next) => {
  try {
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
    req.user.email = fullUser.email;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Create payment
router.post("/payments/create", requireAuth, createPayment);

// CloudPayments webhook (no auth required)
router.post("/payments/cloudpayments/webhook", handleCloudPaymentsWebhook);

// Save card attachment status
router.post("/payments/save-card-attachment", requireAuth, paymentController.saveCardAttachment);

module.exports = router;
