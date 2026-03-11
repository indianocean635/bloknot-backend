const express = require("express");
const { getBusinessName, updateBusinessName } = require("../controllers/businessController");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/business/slug", requireAuth, getBusinessName);
router.get("/business", requireAuth, getBusinessName);
router.patch("/business/name", requireAuth, updateBusinessName);

module.exports = router;
