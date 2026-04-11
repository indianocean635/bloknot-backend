const multer = require("multer");
const crypto = require("crypto");
const path = require("path");
const { prisma } = require("../services/prismaService");
const { uploadFile } = require("../lib/s3");

function safeFileName(originalName, userId) {
  const ext = path.extname(String(originalName || "")).toLowerCase();
  const allowedExt = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
  const finalExt = allowedExt.includes(ext) ? ext : ".jpg";
  return `${userId}-${Date.now()}${finalExt}`;
}

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 },
});

const worksUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 },
});

// Загрузить/обновить аватар мастера
async function uploadMasterAvatar(req, res) {
  const id = Number(req.params.id);

  if (!req.file) {
    return res.status(400).json({ error: "Файл не выбран" });
  }

  try {
    const master = await prisma.master.findFirst({
      where: { id, businessId: req.user.businessId },
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
  if (!req.file) {
    return res.status(400).json({ error: "Файл не выбран" });
  }
  
  if (!req.user || !req.user.businessId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const { caption, isLogo } = req.body;
    
    // Generate S3 filename
    const fileName = safeFileName(req.file.originalname, req.user.businessId);
    const mimeType = req.file.mimetype || 'image/jpeg';
    
    // Upload to S3
    const imageUrl = await uploadFile(req.file.buffer, fileName, mimeType);

    // Если это логотип, сначала убираем старый логотип
    if (isLogo === "true") {
      await prisma.workPhoto.updateMany({
        where: {
          businessId: req.user.businessId,
          isLogo: true,
        },
        data: { isLogo: false },
      });
    }

    const work = await prisma.workPhoto.create({
      data: {
        businessId: req.user.businessId,
        imageUrl,
        caption: caption || "",
        isLogo: isLogo === "true",
      },
    });

    res.json({
      id: work.id,
      url: work.imageUrl,
      description: work.caption,
      type: work.imageUrl.toLowerCase().includes('.mp4') || work.imageUrl.toLowerCase().includes('.mov') ? 'video' : 'image',
      isLogo: work.isLogo,
      createdAt: work.createdAt
    });
  } catch (error) {
    console.error("Work upload error:", error);
    res.status(500).json({ error: "Ошибка загрузки работы" });
  }
}

// Получить работы
async function getWorks(req, res) {
  const works = await prisma.workPhoto.findMany({
    where: { businessId: req.user.businessId },
    orderBy: { id: "desc" }
  });

  const transformedWorks = works.map(work => ({
    id: work.id,
    url: work.imageUrl,
    description: work.caption,
    type: work.imageUrl.toLowerCase().includes('.mp4') || work.imageUrl.toLowerCase().includes('.mov') ? 'video' : 'image',
    isLogo: work.isLogo,
    createdAt: work.createdAt
  }));

  res.json(transformedWorks);
}

module.exports = {
  uploadMasterAvatar,
  uploadWork,
  getWorks,
  avatarUpload,
  worksUpload
};
