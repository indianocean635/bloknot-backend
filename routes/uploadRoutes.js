const express = require("express");
const { uploadMasterAvatar, uploadWork, getWorks, deleteWork, avatarUpload, worksUpload } = require("../controllers/uploadController");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();

// Upload files
router.post("/masters/:id/avatar", requireAuth, avatarUpload.single("avatar"), uploadMasterAvatar);
router.post("/works", requireAuth, worksUpload.single("image"), uploadWork);
router.get("/works", requireAuth, getWorks);
router.delete("/works/:id", requireAuth, deleteWork);

module.exports = router;
