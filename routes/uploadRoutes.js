const express = require("express");
const { uploadMasterAvatar, uploadWork, getWorks, deleteWork, avatarUpload, worksUpload } = require("../controllers/uploadController");
const { requireMagicAuth, getBusinessFromUser } = require("../middleware/magicAuthMiddleware");

const router = express.Router();

// Upload files
router.post("/masters/:id/avatar", requireMagicAuth, getBusinessFromUser, avatarUpload.single("avatar"), uploadMasterAvatar);
router.post("/works", requireMagicAuth, getBusinessFromUser, worksUpload.single("image"), uploadWork);
router.get("/works", requireMagicAuth, getBusinessFromUser, getWorks);
router.delete("/works/:id", requireMagicAuth, getBusinessFromUser, deleteWork);

module.exports = router;
