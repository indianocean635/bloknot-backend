const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { prisma } = require("../services/prismaService");

const AVATARS_PATH = path.join(__dirname, "..", "public", "uploads", "avatars");
const WORKS_PATH = path.join(__dirname, "..", "public", "uploads", "works");

// Создаем папки если их нет
if (!fs.existsSync(AVATARS_PATH)) fs.mkdirSync(AVATARS_PATH, { recursive: true });
if (!fs.existsSync(WORKS_PATH)) fs.mkdirSync(WORKS_PATH, { recursive: true });

function safeFileName(originalName) {
  const ext = path.extname(String(originalName || "")).toLowerCase();
  const token = crypto.randomBytes(12).toString("hex");
  const allowedExt = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
  const finalExt = allowedExt.includes(ext) ? ext : ".jpg";
  return `${Date.now()}_${token}${finalExt}`;
}

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, AVATARS_PATH),
    filename: (req, file, cb) => cb(null, safeFileName(file.originalname)),
  }),
  limits: { fileSize: 6 * 1024 * 1024 },
});

const worksUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, WORKS_PATH),
    filename: (req, file, cb) => cb(null, safeFileName(file.originalname)),
  }),
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

    // Удаляем старый аватар если есть
    if (master.avatarUrl) {
      try {
        const oldPath = path.join(__dirname, "..", "public", master.avatarUrl);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      } catch (e) {
        console.error("Failed to delete old avatar:", e);
      }
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
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

  try {
    const { caption, isLogo } = req.body;
    const imageUrl = `/uploads/works/${req.file.filename}`;

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
