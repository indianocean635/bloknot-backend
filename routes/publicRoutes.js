const express = require("express");
const { getBusinessBySlug, getBranches, getServices, getMasters, getWorks } = require("../controllers/businessController");
const { requireAuth, getBusinessBySlug: businessMiddleware } = require("../middleware/authMiddleware");

const router = express.Router();

// Публичные эндпоинты
router.get("/business/:slug", getBusinessBySlug);
router.get("/branches/:slug", businessMiddleware, getBranches);
router.get("/services/:slug", businessMiddleware, getServices);
router.get("/masters/:slug", businessMiddleware, getMasters);
router.get("/works/:slug", businessMiddleware, getWorks);

module.exports = router;
