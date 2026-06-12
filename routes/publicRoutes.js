const express = require("express");
const { getBusinessBySlug, getBranches, getServices, getMasters, getWorks } = require("../controllers/businessController");
const { requireAuth, getBusinessBySlug: businessMiddleware } = require("../middleware/authMiddleware");

const router = express.Router();

// Публичные эндпоинты
router.get("/business/:slug", getBusinessBySlug);
router.get("/branches/:slug", getBranches);
router.get("/services/:slug", getServices);
router.get("/masters/:slug", getMasters);
router.get("/works/:slug", getWorks);

module.exports = router;
