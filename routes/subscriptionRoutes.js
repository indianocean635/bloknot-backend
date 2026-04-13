const express = require("express");
const { 
  getSubscription, 
  createSubscription, 
  getPlans 
} = require("../controllers/subscriptionController");
const { requireMagicAuth, getBusinessFromUser } = require("../middleware/magicAuthMiddleware");

const router = express.Router();

// Get current subscription
router.get("/subscription", requireMagicAuth, getBusinessFromUser, getSubscription);

// Create or update subscription
router.post("/subscription", requireMagicAuth, getBusinessFromUser, createSubscription);

// Get available plans
router.get("/plans", requireMagicAuth, getBusinessFromUser, getPlans);

module.exports = router;
