const express = require("express");
const { getBusinessName, updateBusinessName, getBusinessByEmail, getBusiness, createBusiness, updateBusiness, getBusinessBySlug } = require("../controllers/businessController");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();

// GET /api/business - Get user's business
router.get("/", requireAuth, (req, res, next) => {
  console.log('GET /api/business called');
  next();
}, getBusiness);

// POST /api/business - Create new business
router.post("/", requireAuth, (req, res, next) => {
  console.log('POST /api/business called');
  next();
}, createBusiness);

// PUT /api/business - Update business
router.put("/", requireAuth, (req, res, next) => {
  console.log('PUT /api/business called');
  next();
}, updateBusiness);

router.get("/slug", requireAuth, (req, res, next) => {
  console.log('GET /api/business/slug called');
  next();
}, getBusinessName);
router.get("/booking/:email", getBusinessByEmail);
router.get("/by-slug/:slug", getBusinessBySlug);
router.patch("/name", requireAuth, updateBusinessName);

module.exports = router;
