const express = require("express");
const { uploadMasterAvatar, uploadWork, getWorks, deleteWork, avatarUpload, worksUpload } = require("../controllers/uploadController");
const { requireMagicAuth, getBusinessFromUser } = require("../middleware/magicAuthMiddleware");

const router = express.Router();

// Proxy for S3 images to avoid CORS issues - must be before other routes
router.get("/proxy/:filename", async (req, res) => {
  try {
    const imageUrl = `https://s3.storage.selcloud.ru/bloknot-storage-1775930209/${req.params.filename}`;
    console.log('[PROXY] Fetching image:', imageUrl);
    const response = await fetch(imageUrl);

    if (!response.ok) {
      console.error('[PROXY] Failed to fetch image:', response.status);
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
    console.log('[PROXY] Image sent successfully');
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).send('Proxy error');
  }
});

// Upload files
router.post("/masters/:id/avatar", requireMagicAuth, getBusinessFromUser, avatarUpload.single("avatar"), uploadMasterAvatar);
router.post("/works", requireMagicAuth, getBusinessFromUser, worksUpload.single("image"), uploadWork);
router.get("/works", requireMagicAuth, getBusinessFromUser, getWorks);
router.delete("/works/:id", requireMagicAuth, getBusinessFromUser, deleteWork);

module.exports = router;
