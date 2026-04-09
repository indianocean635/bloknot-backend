const express = require("express");
const { getBusinessName, updateBusinessName, getBusinessByEmail } = require("../controllers/businessController");
const { requireMagicAuth } = require("../middleware/magicAuthMiddleware");

const router = express.Router();

router.get("/business/slug", requireMagicAuth, (req, res, next) => {
  console.log('GET /api/business/slug called');
  next();
}, getBusinessName);
router.get("/business", requireMagicAuth, getBusinessName);
router.get("/booking/:email", getBusinessByEmail);
router.patch("/business/name", requireMagicAuth, updateBusinessName);

module.exports = router;
