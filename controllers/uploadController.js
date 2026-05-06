const multer = require("multer");
const crypto = require("crypto");
const path = require("path");
const { prisma } = require("../services/prismaService");
const { uploadFile, getSignedUrlForFile } = require('../lib/s3');

function safeFileName(originalName, userId) {
  const ext = path.extname(String(originalName || "")).toLowerCase();
  const allowedExt = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
  const finalExt = allowedExt.includes(ext) ? ext : ".jpg";
  return `${userId}-${Date.now()}${finalExt}`;
}

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const worksUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Загрузить/обновить аватар мастера
async function uploadMasterAvatar(req, res) {
  try {
    console.log('[REQUEST]', {
      userId: req.user?.id,
      businessId: req.user?.businessId,
      route: req.originalUrl
    });

    const user = req.user;
    
    if (!user || !user.businessId) {
      console.warn('[SECURITY] Missing user or businessId', { userId: req.user?.id, businessId: req.user?.businessId });
      return res.status(403).json({ error: 'Forbidden' });
    }

    const id = Number(req.params.id);

    if (!req.file) {
      return res.status(400).json({ error: "Файл не выбран" });
    }

    const master = await prisma.master.findFirst({
      where: { id, businessId: user.businessId },
    });
    if (!master) return res.status(404).json({ error: "Мастер не найден" });

    // Generate S3 filename
    const fileName = safeFileName(req.file.originalname, master.id);
    const mimeType = req.file.mimetype || 'image/jpeg';
    
    // Upload to S3
    const avatarUrl = await uploadFile(req.file.buffer, fileName, mimeType);
    await prisma.master.update({
      where: { id },
      data: { avatarUrl },
    });

    res.json({ avatarUrl });
  } catch (error) {
    console.error("Avatar upload error:", error);
    res.status(500).json({ error: "Ошибка загрузки аватара" });
  }
}

// Загрузить работу
async function uploadWork(req, res) {
  try {
    console.log('[UPLOAD WORK REQUEST]', {
      userId: req.user?.id,
      businessId: req.user?.businessId,
      route: req.originalUrl,
      hasFile: !!req.file,
      isLogo: req.body.isLogo,
      caption: req.body.caption
    });

    const user = req.user;

    if (!user || !user.businessId) {
      console.warn('[SECURITY] Missing user or businessId', { userId: req.user?.id, businessId: req.user?.businessId });
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!req.file) {
      console.error('[UPLOAD] No file provided');
      return res.status(400).json({ error: "Файл не выбран" });
    }

    const { caption, isLogo } = req.body;

    console.log('[UPLOAD] Starting S3 upload...');

    // Generate S3 filename
    const fileName = safeFileName(req.file.originalname, user.businessId);
    const mimeType = req.file.mimetype || 'image/jpeg';

    console.log('[UPLOAD] File details:', { fileName, mimeType, fileSize: req.file.buffer.length });

    // Upload to S3
    const imageUrl = await uploadFile(req.file.buffer, fileName, mimeType);

    console.log('[UPLOAD] S3 upload successful:', imageUrl);

    // Если это логотип, сначала убираем старый логотип
    if (isLogo === "true") {
      console.log('[UPLOAD] Removing old logo...');
      const updateResult = await prisma.workPhoto.updateMany({
        where: {
          businessId: user.businessId,
          isLogo: true,
        },
        data: { isLogo: false },
      });
      console.log('[UPLOAD] Old logos removed:', updateResult);
    }

    console.log('[UPLOAD] Creating WorkPhoto record...');
    const work = await prisma.workPhoto.create({
      data: {
        businessId: user.businessId,
        imageUrl,
        caption: caption || "",
        isLogo: isLogo === "true",
      },
    });

    console.log('[UPLOAD] WorkPhoto created:', work);

    res.json({
      id: work.id,
      url: work.imageUrl,
      description: work.caption,
      type: work.imageUrl.toLowerCase().includes('.mp4') || work.imageUrl.toLowerCase().includes('.mov') ? 'video' : 'image',
      isLogo: work.isLogo,
      createdAt: work.createdAt
    });
  } catch (error) {
    console.error("[UPLOAD] Work upload error:", error);
    res.status(500).json({ error: "Ошибка загрузки работы" });
  }
}

// Получить работы
async function getWorks(req, res) {
  try {
    console.log('[REQUEST]', {
      userId: req.user?.id,
      businessId: req.user?.businessId,
      route: req.originalUrl
    });

    const user = req.user;

    if (!user || !user.businessId) {
      console.warn('[SECURITY] Missing user or businessId', { userId: req.user?.id, businessId: req.user?.businessId });
      return res.status(403).json({ error: 'Forbidden' });
    }

    const works = await prisma.workPhoto.findMany({
      where: { businessId: user.businessId },
      orderBy: { id: "desc" }
    });

    // Generate signed URLs for each work
    const transformedWorks = await Promise.all(works.map(async (work) => {
      // Extract filename from imageUrl
      const filename = work.imageUrl.split('/').pop();
      // Generate signed URL (valid for 1 hour)
      const signedUrl = await getSignedUrlForFile(filename, 3600);

      return {
        id: work.id,
        url: signedUrl,
        description: work.caption,
        type: work.imageUrl.toLowerCase().includes('.mp4') || work.imageUrl.toLowerCase().includes('.mov') ? 'video' : 'image',
        isLogo: work.isLogo,
        createdAt: work.createdAt
      };
    }));

    res.json(transformedWorks);
  } catch (error) {
    console.error("Get works error:", error);
    res.status(500).json({ error: "Ошибка получения работ" });
  }
}

// Удалить работу
async function deleteWork(req, res) {
  try {
    console.log('[DELETE WORK REQUEST]', {
      userId: req.user?.id,
      businessId: req.user?.businessId,
      route: req.originalUrl,
      workId: req.params.id
    });

    const user = req.user;

    if (!user || !user.businessId) {
      console.warn('[SECURITY] Missing user or businessId', { userId: req.user?.id, businessId: req.user?.businessId });
      return res.status(403).json({ error: 'Forbidden' });
    }

    const workId = parseInt(req.params.id);

    // Check if work belongs to user's business
    const work = await prisma.workPhoto.findFirst({
      where: {
        id: workId,
        businessId: user.businessId
      }
    });

    if (!work) {
      return res.status(404).json({ error: "Работа не найдена" });
    }

    // Delete from database
    await prisma.workPhoto.delete({
      where: { id: workId }
    });

    console.log('[DELETE WORK] Work deleted successfully:', workId);
    res.json({ success: true });
  } catch (error) {
    console.error("Delete work error:", error);
    res.status(500).json({ error: "Ошибка удаления работы" });
  }
}

module.exports = {
  uploadMasterAvatar,
  uploadWork,
  getWorks,
  deleteWork,
  avatarUpload,
  worksUpload
};
