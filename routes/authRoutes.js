const express = require("express");
const { sendMagicLink, loginWithMagicLink, logout, getCurrentUser } = require("../controllers/authController");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/magic-link", sendMagicLink);
router.get("/magic/:token", loginWithMagicLink);
router.post("/logout", logout);
router.get("/me", requireAuth, getCurrentUser);

module.exports = router;
