const express = require("express");
const { uploadMasterAvatar, uploadWork, getWorks, deleteWork, avatarUpload, worksUpload } = require("../controllers/uploadController");
const { requireMagicAuth, getBusinessFromUser } = require("../middleware/magicAuthMiddleware");

const router = express.Router();

// Upload files
router.post("/masters/:id/avatar", requireMagicAuth, getBusinessFromUser, avatarUpload.single("avatar"), uploadMasterAvatar);
router.post("/works", requireMagicAuth, getBusinessFromUser, worksUpload.single("image"), uploadWork);
router.get("/works", requireMagicAuth, getBusinessFromUser, getWorks);
router.delete("/works/:id", requireMagicAuth, getBusinessFromUser, deleteWork);

// Proxy for S3 images to avoid CORS issues
router.get("/proxy/:filename", async (req, res) => {
  try {
    const imageUrl = `https://s3.storage.selcloud.ru/bloknot-storage-1775930209/${req.params.filename}`;
    const response = await fetch(imageUrl);

    if (!response.ok) {
      return res.status(404).send('Image not found');
    }

    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET');

    // Set content type
    const contentType = response.headers.get('content-type');
    if (contentType) {
      res.set('Content-Type', contentType);
    }

    // Pipe the image data
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).send('Proxy error');
  }
});

module.exports = router;
