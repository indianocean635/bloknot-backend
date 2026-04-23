const express = require("express");
const { getBusinessName, updateBusinessName, getBusinessByEmail, getBusiness, createBusiness, updateBusiness } = require("../controllers/businessController");
const { requireMagicAuth } = require("../middleware/magicAuthMiddleware");

const router = express.Router();

// GET /api/business - Get user's business
router.get("/", requireMagicAuth, (req, res, next) => {
  console.log('GET /api/business called');
  next();
}, getBusiness);

// POST /api/business - Create new business
router.post("/", requireMagicAuth, (req, res, next) => {
  console.log('POST /api/business called');
  next();
}, createBusiness);

// PUT /api/business - Update business
router.put("/", requireMagicAuth, (req, res, next) => {
  console.log('PUT /api/business called');
  next();
}, updateBusiness);

router.get("/slug", requireMagicAuth, (req, res, next) => {
  console.log('GET /api/business/slug called');
  next();
}, getBusinessName);
router.get("/booking/:email", getBusinessByEmail);
router.patch("/name", requireMagicAuth, updateBusinessName);

module.exports = router;
