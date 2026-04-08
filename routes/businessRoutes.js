const express = require("express");
const { getBusinessName, updateBusinessName } = require("../controllers/businessController");
const { requireMagicAuth } = require("../middleware/magicAuthMiddleware");

const router = express.Router();

router.get("/business/slug", requireMagicAuth, getBusinessName);
router.get("/business", requireMagicAuth, getBusinessName);
router.patch("/business/name", requireMagicAuth, updateBusinessName);

module.exports = router;
