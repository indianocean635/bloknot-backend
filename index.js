
const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { PrismaClient } = require("@prisma/client");
const nodemailer = require("nodemailer");
const sgMail = require("@sendgrid/mail");
const jwt = require("jsonwebtoken");

require("dotenv").config();

const app = express();
const prisma = new PrismaClient();

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM;

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : null;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_SECURE = process.env.SMTP_SECURE === "1" || process.env.SMTP_SECURE === "true";
const MAIL_FROM = process.env.MAIL_FROM;

function createMailer() {
  if (!SMTP_HOST || !SMTP_PORT || !MAIL_FROM) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS || "" } : undefined,
  });
}

function canUseSendgrid() {
  return Boolean(SENDGRID_API_KEY && EMAIL_FROM);
}

async function sendMagicLinkEmail(toEmail, magicLink) {
  const subject = "Вход в Bloknot";
  const text = `Здравствуйте!\n\nВаша ссылка для входа:\n${magicLink}\n\nЕсли вы не запрашивали вход — просто проигнорируйте это письмо.\n`;
  const html = `
    <div style="font-family:Arial,sans-serif; line-height:1.5">
      <h2 style="margin:0 0 12px">Вход в Bloknot</h2>
      <p style="margin:0 0 12px">Нажмите, чтобы войти:</p>
      <p style="margin:0 0 16px"><a href="${magicLink}">${magicLink}</a></p>
      <p style="color:#666; margin:0">Если вы не запрашивали вход — просто проигнорируйте это письмо.</p>
    </div>
  `;

  // 1) SendGrid (preferred)
  if (canUseSendgrid()) {
    sgMail.setApiKey(SENDGRID_API_KEY);
    await sgMail.send({
      to: toEmail,
      from: EMAIL_FROM,
      subject,
      text,
      html,
    });
    return { provider: "sendgrid" };
  }

  // 2) SMTP fallback
  const mailer = createMailer();
  if (mailer) {
    await mailer.sendMail({
      from: MAIL_FROM,
      to: toEmail,
      subject,
      text,
      html,
    });
    return { provider: "smtp" };
  }

  // 3) No mail provider configured
  return { provider: "none" };
}

// --- middleware ---
app.use(express.json());

// CORS
// В проде лучше держать фронт и API на одном домене и не использовать CORS вовсе.
// Оставляем управляемый режим через env для dev/edge-кейсов.
app.use((req, res, next) => {
  const corsOrigin = process.env.CORS_ORIGIN;
  if (corsOrigin) {
    res.setHeader("Access-Control-Allow-Origin", corsOrigin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PATCH, DELETE, OPTIONS"
    );
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
  }
  next();
});

const PORT = Number(process.env.PORT || 3001);
const BASE_URL = String(process.env.BASE_URL || `http://localhost:${PORT}`).replace(
  /\/$/,
  ""
);

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_COOKIE_NAME = "auth";
const IS_PROD = process.env.NODE_ENV === "production";

function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  const out = {};
  header.split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i < 0) return;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    out[k] = decodeURIComponent(v);
  });
  return out;
}

function setAuthCookie(res, token) {
  const maxAge = 7 * 24 * 60 * 60;
  const parts = [
    `${JWT_COOKIE_NAME}=${encodeURIComponent(token)}`,
    `Max-Age=${maxAge}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (IS_PROD) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearAuthCookie(res) {
  const parts = [
    `${JWT_COOKIE_NAME}=`,
    "Max-Age=0",
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (IS_PROD) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function getAuthUser(req) {
  if (!JWT_SECRET) return null;
  const cookies = parseCookies(req);
  const token = cookies[JWT_COOKIE_NAME];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload || typeof payload !== "object") return null;
    const userId = payload.userId;
    if (typeof userId !== "number") return null;
    return { id: userId };
  } catch (e) {
    return null;
  }
}

function requireAuth(req, res, next) {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  req.user = user;
  next();
}

// Static frontend path
// По умолчанию ожидаем статический фронт в папке ./public рядом с index.js
const FRONTEND_PATH = process.env.FRONTEND_PATH
  ? path.resolve(process.env.FRONTEND_PATH)
  : path.join(__dirname, "public");

// Uploads storage path
// В проде лучше хранить uploads в backend-папке (или в отдельном volume), а не внутри frontend исходников.
const UPLOADS_PATH = process.env.UPLOADS_PATH
  ? path.resolve(process.env.UPLOADS_PATH)
  : path.join(__dirname, "uploads");

const AVATARS_PATH = path.join(UPLOADS_PATH, "avatars");
const WORKS_PATH = path.join(UPLOADS_PATH, "works");

fs.mkdirSync(AVATARS_PATH, { recursive: true });
fs.mkdirSync(WORKS_PATH, { recursive: true });

console.log("FRONTEND PATH:", FRONTEND_PATH);
console.log("UPLOADS PATH:", UPLOADS_PATH);
console.log("BASE URL:", BASE_URL);

if (!prisma || !prisma.branch || !prisma.loginToken) {
  console.error(
    "PRISMA CLIENT ERROR: some models are missing on PrismaClient. Usually it means @prisma/client was not generated for current schema. Run: prisma generate"
  );
}

// раздаём фронт
app.use(express.static(FRONTEND_PATH));

app.get("/favicon.ico", (req, res) => {
  res.redirect(302, "/favicon.png");
});

// раздаём загруженные файлы
app.use("/uploads", express.static(UPLOADS_PATH));

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
  limits: { fileSize: 12 * 1024 * 1024 },
});

// --- AUTH MIDDLEWARE (API) ---
// Оставляем публичными ровно те API, которые нужны для публичной страницы записи.
const PUBLIC_API = new Set([
  "GET /api/services",
  "GET /api/masters",
  "POST /api/appointments",
]);

app.use((req, res, next) => {
  if (!req.path.startsWith("/api/")) return next();
  const key = `${req.method.toUpperCase()} ${req.path}`;
  if (PUBLIC_API.has(key)) return next();
  return requireAuth(req, res, next);
});

// --- AUTH ---
app.post("/auth/request-link", async (req, res) => {
  const { email } = req.body;

  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    return res.status(400).json({ error: "Email обязателен" });
  }

  let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        role: "OWNER",
      },
    });
  }

  const token = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");

  await prisma.loginToken.create({
    data: {
      token,
      userId: user.id,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  const publicBase = IS_PROD ? "https://bloknotservis.ru" : BASE_URL;
  const magicLink = `${publicBase}/auth/confirm?token=${encodeURIComponent(token)}`;

  try {
    const r = await sendMagicLinkEmail(normalizedEmail, magicLink);
    if (r.provider === "none") {
      console.log(
        "MAIL is not configured. Configure SendGrid (SENDGRID_API_KEY + EMAIL_FROM) or SMTP (SMTP_HOST/SMTP_PORT/MAIL_FROM ...) to send emails."
      );
      console.log("MAGIC LINK:", magicLink);
    }
  } catch (e) {
    console.error("MAIL SEND ERROR:", e);
    console.log("MAGIC LINK:", magicLink);
  }

  res.json({ ok: true });
});

// ===== BRANCHES API =====

app.get("/api/branches", async (req, res) => {
  const items = await prisma.branch.findMany({ orderBy: { id: "asc" } });
  res.json(items);
});

app.post("/api/branches", async (req, res) => {
  const { name, address } = req.body;
  if (!name) return res.status(400).json({ error: "Название обязательно" });

  const item = await prisma.branch.create({
    data: { name: String(name), address: address ? String(address) : null },
  });
  res.json(item);
});

app.patch("/api/branches/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { name, address } = req.body;
  const data = {};
  if (name !== undefined) data.name = String(name);
  if (address !== undefined) data.address = address ? String(address) : null;
  const item = await prisma.branch.update({ where: { id }, data });
  res.json(item);
});

app.delete("/api/branches/:id", async (req, res) => {
  const id = Number(req.params.id);
  await prisma.branch.delete({ where: { id } });
  res.json({ ok: true });
});

app.get("/auth/confirm", async (req, res) => {
  if (!JWT_SECRET) {
    return res.status(500).send("Server is not configured");
  }

  const token = String(req.query.token || "").trim();
  if (!token) return res.status(400).send("Ссылка недействительна");

  const loginToken = await prisma.loginToken.findUnique({ where: { token } });
  if (!loginToken || loginToken.expiresAt < new Date()) {
    return res.status(400).send("Ссылка недействительна");
  }

  await prisma.loginToken.delete({ where: { token } });

  const jwtToken = jwt.sign({ userId: loginToken.userId }, JWT_SECRET, { expiresIn: "7d" });
  setAuthCookie(res, jwtToken);

  res.redirect("/dashboard");
});

app.get("/dashboard", (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.redirect("/");
  res.sendFile(path.join(FRONTEND_PATH, "dashboard.html"));
});

// legacy endpoints (disabled)
app.post("/auth/request-login", (req, res) => {
  res.status(410).json({ error: "Endpoint removed" });
});
app.get("/auth/login", (req, res) => {
  res.status(410).send("Endpoint removed");
});

// ===== CATEGORIES API =====

// Получить все категории
app.get("/api/categories", async (req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: { id: "asc" },
  });
  res.json(categories);
});

// Создать категорию
app.post("/api/categories", async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Название обязательно" });
  }

  const category = await prisma.category.create({
    data: { name },
  });

  res.json(category);
});

// Удалить категорию
app.delete("/api/categories/:id", async (req, res) => {
  const id = Number(req.params.id);

  await prisma.service.updateMany({
    where: { categoryId: id },
    data: { categoryId: null },
  });

  await prisma.category.delete({
    where: { id },
  });

  res.json({ ok: true });
});

// --- START ---
// Явно отдаём главную страницу
app.get("/", (req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, "index.html"));
});

// ===== SERVICES API =====

// Получить все услуги
app.get("/api/services", async (req, res) => {
  const services = await prisma.service.findMany({
    orderBy: { id: "asc" },
    include: { category: true },
  });
  res.json(services);
});

// Создать услугу
app.post("/api/services", async (req, res) => {
  const { name, duration, price, categoryId } = req.body;

  if (!name || !duration || !price) {
    return res.status(400).json({ error: "Заполните все поля" });
  }

  const service = await prisma.service.create({
    data: {
      name,
      duration: Number(duration),
      price: Number(price),
      categoryId: categoryId ? Number(categoryId) : null,
    },
  });

  res.json(service);
});

// Удалить услугу
app.delete("/api/services/:id", async (req, res) => {
  const id = Number(req.params.id);

  await prisma.service.delete({
    where: { id },
  });

  res.json({ ok: true });
});

// ===== MASTERS API =====

// Получить всех мастеров
app.get("/api/masters", async (req, res) => {
  const masters = await prisma.master.findMany({
    orderBy: { id: "asc" },
  });
  res.json(masters);
});

// Создать мастера
app.post("/api/masters", async (req, res) => {
  const { name, active, role } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Имя обязательно" });
  }

  const master = await prisma.master.create({
    data: {
      name: String(name),
      active: typeof active === "boolean" ? active : true,
      role: role ? String(role) : "MASTER",
    },
  });

  res.json(master);
});

// Загрузить/обновить аватар мастера
app.post("/api/masters/:id/avatar", avatarUpload.single("avatar"), async (req, res) => {
  const id = Number(req.params.id);

  if (!req.file) {
    return res.status(400).json({ error: "Файл не выбран" });
  }

  const master = await prisma.master.findUnique({ where: { id } });
  if (!master) {
    return res.status(404).json({ error: "Мастер не найден" });
  }

  const avatarUrl = `/uploads/avatars/${req.file.filename}`;

  if (master.avatarUrl) {
    const prev = path.join(UPLOADS_PATH, master.avatarUrl.replace(/^\/uploads\/?/, ""));
    fs.unlink(prev, () => {});
  }

  const updated = await prisma.master.update({
    where: { id },
    data: { avatarUrl },
  });

  res.json(updated);
});

// Обновить мастера (минимально)
app.patch("/api/masters/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { name, active, role } = req.body;

  const data = {};
  if (name !== undefined) data.name = String(name);
  if (active !== undefined) data.active = Boolean(active);
  if (role !== undefined) data.role = String(role);

  const master = await prisma.master.update({
    where: { id },
    data,
  });

  res.json(master);
});

// Удалить мастера
app.delete("/api/masters/:id", async (req, res) => {
  const id = Number(req.params.id);

  const master = await prisma.master.findUnique({ where: { id } });

  await prisma.master.delete({
    where: { id },
  });

  if (master && master.avatarUrl) {
    const prev = path.join(UPLOADS_PATH, master.avatarUrl.replace(/^\/uploads\/?/, ""));
    fs.unlink(prev, () => {});
  }

  res.json({ ok: true });
});

// ===== WORKS (PHOTOS) API =====

app.get("/api/works", async (req, res) => {
  const photos = await prisma.workPhoto.findMany({
    orderBy: { id: "desc" },
  });
  res.json(photos);
});

app.post("/api/works", worksUpload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Файл не выбран" });
  }

  const imageUrl = `/uploads/works/${req.file.filename}`;
  const caption = req.body && req.body.caption ? String(req.body.caption) : null;

  const photo = await prisma.workPhoto.create({
    data: {
      imageUrl,
      caption,
    },
  });

  res.json(photo);
});

app.delete("/api/works/:id", async (req, res) => {
  const id = Number(req.params.id);
  const photo = await prisma.workPhoto.findUnique({ where: { id } });

  await prisma.workPhoto.delete({ where: { id } });

  if (photo && photo.imageUrl) {
    const prev = path.join(UPLOADS_PATH, photo.imageUrl.replace(/^\/uploads\/?/, ""));
    fs.unlink(prev, () => {});
  }

  res.json({ ok: true });
});

// ===== APPOINTMENTS (CALENDAR) API =====

function parseDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

app.get("/api/appointments", async (req, res) => {
  const { from, to, masterId } = req.query;
  const where = {};

  const fromDate = from ? parseDate(from) : null;
  const toDate = to ? parseDate(to) : null;

  if (fromDate || toDate) {
    where.startsAt = {};
    if (fromDate) where.startsAt.gte = fromDate;
    if (toDate) where.startsAt.lte = toDate;
  }
  if (masterId) where.masterId = Number(masterId);

  const items = await prisma.appointment.findMany({
    where,
    orderBy: { startsAt: "asc" },
    include: { service: true, master: true, branch: true },
  });

  res.json(items);
});

app.post("/api/appointments", async (req, res) => {
  const { customerName, customerPhone, startsAt, serviceId, masterId, branchId } = req.body;

  if (!customerName || !startsAt || !serviceId || !masterId) {
    return res.status(400).json({ error: "Заполните клиента, услугу, мастера и время" });
  }

  const start = parseDate(startsAt);
  if (!start) {
    return res.status(400).json({ error: "Некорректная дата" });
  }

  const service = await prisma.service.findUnique({ where: { id: Number(serviceId) } });
  if (!service) {
    return res.status(400).json({ error: "Услуга не найдена" });
  }

  const durationMs = Number(service.duration) * 60 * 1000;
  const end = new Date(start.getTime() + durationMs);

  const mid = Number(masterId);
  const overlap = await prisma.appointment.findFirst({
    where: {
      masterId: mid,
      AND: [{ startsAt: { lt: end } }, { endsAt: { gt: start } }],
    },
  });
  if (overlap) {
    return res.status(409).json({ error: "У мастера уже есть запись на это время" });
  }

  const item = await prisma.appointment.create({
    data: {
      customerName: String(customerName),
      customerPhone: customerPhone ? String(customerPhone) : null,
      startsAt: start,
      endsAt: end,
      priceAtBooking: Number(service.price),
      serviceId: Number(serviceId),
      masterId: mid,
      branchId: branchId ? Number(branchId) : null,
    },
    include: { service: true, master: true, branch: true },
  });

  res.json(item);
});

app.delete("/api/appointments/:id", async (req, res) => {
  const id = Number(req.params.id);
  await prisma.appointment.delete({ where: { id } });
  res.json({ ok: true });
});

app.use((err, req, res, next) => {
  console.error("UNHANDLED ERROR:", err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Server error" });
});

app.listen(PORT, () => {
  console.log(`Backend запущен на ${BASE_URL}`);
});
