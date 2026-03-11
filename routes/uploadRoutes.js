const express = require("express");
const { uploadMasterAvatar, uploadWork, getWorks, avatarUpload, worksUpload } = require("../controllers/uploadController");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();

// Загрузка файлов
router.post("/masters/:id/avatar", requireAuth, avatarUpload.single("avatar"), uploadMasterAvatar);
router.post("/works", requireAuth, worksUpload.single("image"), uploadWork);
router.get("/works", requireAuth, getWorks);

module.exports = router;
