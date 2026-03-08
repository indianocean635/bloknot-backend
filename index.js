require("dotenv").config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.yandex.ru',
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});
const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { PrismaClient } = require("@prisma/client");

const jwt = require("jsonwebtoken");


const app = express();
const prisma = new PrismaClient();

const EMAIL_FROM = process.env.EMAIL_FROM;

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : null;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_SECURE = process.env.SMTP_SECURE === "1" || process.env.SMTP_SECURE === "true";
const MAIL_FROM = process.env.MAIL_FROM;
console.log("ОТПРАВКА ПИСЬМА...");
async function sendMagicLinkEmail(toEmail, magicLink) {
  const subject = "Вход в Bloknot";
  const text = `Здравствуйте!

Ваша ссылка для входа:
${magicLink}

Если вы не запрашивали вход — просто проигнорируйте это письмо.`;

  const html = `
    <div style="font-family:Arial,sans-serif; line-height:1.5">
      <h2>Вход в Bloknot</h2>
      <p>Нажмите, чтобы войти:</p>
      <p><a href="${magicLink}">${magicLink}</a></p>
      <p style="color:#666">
        Если вы не запрашивали вход — проигнорируйте это письмо.
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: `"Bloknot" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject,
    text,
    html,
  });

  // 3) No mail provider configured
  return;
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
const SUPERADMIN_COOKIE_NAME = "sa_auth";
const IS_PROD = process.env.NODE_ENV === "production";
const SUPERADMIN_EMAIL = String(process.env.SUPERADMIN_EMAIL || "")
  .trim()
  .toLowerCase();

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
  const maxAge = 90 * 24 * 60 * 60;
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

function setSuperAdminCookie(res, token) {
  const maxAge = 90 * 24 * 60 * 60;
  const parts = [
    `${SUPERADMIN_COOKIE_NAME}=${encodeURIComponent(token)}`,
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
  return getJwtUser(req, JWT_COOKIE_NAME);
}

function getJwtUser(req, cookieName) {
  if (!JWT_SECRET) return null;
  const cookies = parseCookies(req);
  const token = cookies[cookieName];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload || typeof payload !== "object") return null;
    const userId = payload.userId;
    if (typeof userId !== "string" || !userId) return null;
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

async function getBusinessBySlug(req, res, next) {
  const slug = req.params.slug || req.query.slug;
  console.log('getBusinessBySlug called with slug:', slug);
  console.log('req.params:', req.params);
  console.log('req.query:', req.query);
  
  if (!slug) return res.status(400).json({ error: "Slug required" });
  
  const business = await prisma.business.findUnique({ where: { slug } });
  if (!business) return res.status(404).json({ error: "Business not found" });
  
  console.log('Business found:', business.id, business.name);
  req.business = business;
  next();
}

async function requireSuperAdmin(req, res, next) {
  if (!SUPERADMIN_EMAIL) return res.status(500).json({ error: "Server is not configured" });

  const saUser = getJwtUser(req, SUPERADMIN_COOKIE_NAME);
  if (saUser) {
    const u = await prisma.user.findUnique({ where: { id: saUser.id } });
    if (u && String(u.email || "").toLowerCase() === SUPERADMIN_EMAIL) {
      req.user = { id: u.id, email: u.email, role: u.role };
      return next();
    }
  }

  const authUser = getAuthUser(req);
  if (!authUser) return res.status(401).json({ error: "Unauthorized" });

  const u = await prisma.user.findUnique({ where: { id: authUser.id } });
  if (!u) return res.status(401).json({ error: "Unauthorized" });
  if (String(u.email || "").toLowerCase() !== SUPERADMIN_EMAIL) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const saToken = jwt.sign({ userId: u.id }, JWT_SECRET, { expiresIn: "90d" });
    setSuperAdminCookie(res, saToken);
  } catch (e) {}

  req.user = { id: u.id, email: u.email, role: u.role };
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
app.use(express.static(FRONTEND_PATH, {
  setHeaders: (res, path) => {
    // Prevent caching of HTML files
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    // Cache CSS/JS with short TTL for updates
    else if (path.endsWith('.css') || path.endsWith('.js')) {
      res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
    }
  }
}));

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
  "GET /api/public/services",
  "GET /api/public/masters",
  "GET /api/public/categories",
  "GET /api/public/works",
  "GET /api/public/branches",
  "GET /api/public/business",
  "POST /api/public/appointments",
]);

app.use((req, res, next) => {
  if (!req.path.startsWith("/api/")) return next();
  const key = `${req.method.toUpperCase()} ${req.path}`;
  if (PUBLIC_API.has(key)) return next();
  return requireAuth(req, res, next);
});

// --- AUTH ---
app.post("/auth/request-link", async (req, res) => {
console.log("ЗАПРОС НА ВХОД:", req.body.email);
  const { email } = req.body;

  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    return res.status(400).json({ error: "Email обязателен" });
  }

  let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    // Check for pending staff invite
    const invite = await prisma.staffInvite.findFirst({ 
      where: { email: normalizedEmail, status: "pending" },
      include: { business: true }
    });
    
    if (invite) {
      // Join as staff
      const [newUser] = await prisma.$transaction([
        prisma.user.create({
          data: {
            email: normalizedEmail,
            role: "STAFF",
            businessId: invite.businessId,
          },
        }),
        prisma.staffInvite.update({
          where: { id: invite.id },
          data: { status: "accepted" },
        }),
      ]);
      user = newUser;
    } else {
      // Create new user first
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          role: "OWNER",
        },
      });
      
      // Create business and connect owner
      const business = await prisma.business.create({
        data: {
          name: `${normalizedEmail} Business`,
          slug: crypto.randomUUID(),
          owner: {
            connect: {
              id: user.id
            }
          }
        },
      });
      
      // Update user with businessId
      await prisma.user.update({
        where: { id: user.id },
        data: { businessId: business.id },
      });
    }
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

app.get("/api/branches", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user || !user.businessId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  
  const items = await prisma.branch.findMany({ 
    where: { businessId: user.businessId },
    orderBy: { id: "asc" } 
  });
  res.json(items);
});

app.post("/api/branches", requireAuth, async (req, res) => {
  const { name, address } = req.body;
  if (!name) return res.status(400).json({ error: "Название обязательно" });

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user || !user.businessId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const item = await prisma.branch.create({
    data: { 
      name: String(name), 
      address: address ? String(address) : null,
      businessId: user.businessId
    },
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

  const jwtToken = jwt.sign({ userId: loginToken.userId }, JWT_SECRET, { expiresIn: "90d" });
  setAuthCookie(res, jwtToken);

  res.redirect("/dashboard");
});

app.get("/api/version", (req, res) => {
  res.json({ version: "3" });
});

app.get("/dashboard", (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.redirect("/");
  res.sendFile(path.join(FRONTEND_PATH, "dashboard.html"));
});

app.get("/settings", requireAuth, (req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, "settings.html"));
});

app.get("/booking-link", requireAuth, (req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, "booking-link.html"));
});

app.get("/book-template/:slug", (req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, "booking-form.html"));
});

// Получить slug бизнеса для владельца
app.get("/api/business/slug", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ 
    where: { id: req.user.id },
    include: { business: true }
  });
  
  if (!user || !user.business) {
    return res.status(404).json({ error: "Business not found" });
  }
  
  res.json({ slug: user.business.slug });
});

app.get("/admin", requireSuperAdmin, async (req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, "admin.html"));
});

app.get("/api/admin/return", requireSuperAdmin, async (req, res) => {
  if (!JWT_SECRET) {
    return res.status(500).send("Server is not configured");
  }

  const jwtToken = jwt.sign({ userId: req.user.id }, JWT_SECRET, { expiresIn: "90d" });
  setAuthCookie(res, jwtToken);
  res.redirect("/dashboard");
});

app.get("/api/admin/stats", requireSuperAdmin, async (req, res) => {
  const [totalUsers, payingUsers, sumPaidAgg] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isPaying: true } }),
    prisma.user.aggregate({ _sum: { totalPaid: true } }),
  ]);

  const totalPaid = (sumPaidAgg && sumPaidAgg._sum && sumPaidAgg._sum.totalPaid) || 0;
  res.json({ totalUsers, payingUsers, totalPaid });
});

app.get("/api/admin/users", requireSuperAdmin, async (req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      isPaying: true,
      totalPaid: true,
      nextBillingAt: true,
    },
  });
  res.json(users);
});

app.get("/api/admin/impersonate/:id", requireSuperAdmin, async (req, res) => {
  if (!JWT_SECRET) {
    return res.status(500).send("Server is not configured");
  }

  const id = String(req.params.id);
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u) return res.status(404).send("Not found");

  const jwtToken = jwt.sign({ userId: u.id }, JWT_SECRET, { expiresIn: "90d" });
  setAuthCookie(res, jwtToken);
  res.redirect("/dashboard");
});

app.patch("/api/admin/users/:id", requireSuperAdmin, async (req, res) => {
  const id = String(req.params.id);
  const { isPaying, totalPaid, nextBillingAt } = req.body || {};

  const data = {};
  if (typeof isPaying === "boolean") data.isPaying = isPaying;
  if (totalPaid !== undefined) data.totalPaid = Number(totalPaid) || 0;
  if (nextBillingAt !== undefined) {
    const v = String(nextBillingAt || "").trim();
    data.nextBillingAt = v ? new Date(v) : null;
  }

  const u = await prisma.user.update({ where: { id }, data });
  res.json({
    id: u.id,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt,
    isPaying: u.isPaying,
    totalPaid: u.totalPaid,
    nextBillingAt: u.nextBillingAt,
  });
});

app.delete("/api/admin/users/:id", requireSuperAdmin, async (req, res) => {
  const id = String(req.params.id);
  if (req.user && req.user.id === id) {
    return res.status(400).json({ error: "Cannot delete yourself" });
  }

  await prisma.$transaction([
    prisma.loginToken.deleteMany({ where: { userId: id } }),
    prisma.user.delete({ where: { id } }),
  ]);

  res.json({ ok: true });
});

// legacy endpoints (disabled)
app.post("/auth/request-login", (req, res) => {
  res.status(410).json({ error: "Endpoint removed" });
});
app.get("/auth/login", (req, res) => {
  res.status(410).send("Endpoint removed");
});

// ===== CATEGORIES API =====

// Получить все категории (для админки)
app.get("/api/categories", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user || !user.businessId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  
  const categories = await prisma.category.findMany({
    where: { businessId: user.businessId },
    orderBy: { id: "asc" },
  });
  res.json(categories);
});

// Получить все категории (публичные)
app.get("/api/public/categories", getBusinessBySlug, async (req, res) => {
  const categories = await prisma.category.findMany({
    where: { businessId: req.business.id },
    orderBy: { id: "asc" },
  });
  res.json(categories);
});

// Создать категорию (защищенный)
app.post("/api/categories", requireAuth, async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Название обязательно" });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user || !user.businessId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const category = await prisma.category.create({
    data: { name, businessId: user.businessId },
  });

  res.json(category);
});

// Удалить категорию
app.delete("/api/categories/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user || !user.businessId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Check if category belongs to user's business
  const category = await prisma.category.findFirst({
    where: { id, businessId: user.businessId }
  });
  
  if (!category) {
    return res.status(404).json({ error: "Category not found" });
  }

  await prisma.service.updateMany({
    where: { categoryId: id, businessId: user.businessId },
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

// Public booking page by slug
app.get("/book/:slug", (req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, "book-template.html"));
});

// ===== SERVICES API =====

// Получить все услуги (для админки)
app.get("/api/services", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user || !user.businessId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  
  const services = await prisma.service.findMany({
    where: { businessId: user.businessId },
    orderBy: { id: "asc" },
    include: { category: true },
  });
  res.json(services);
});

// Получить все услуги (публичные)
app.get("/api/public/services", getBusinessBySlug, async (req, res) => {
  const services = await prisma.service.findMany({
    where: { businessId: req.business.id },
    orderBy: { id: "asc" },
    include: { category: true },
  });
  res.json(services);
});

// Получить все филиалы (публичные)
app.get("/api/public/branches", getBusinessBySlug, async (req, res) => {
  const branches = await prisma.branch.findMany({
    where: { businessId: req.business.id },
    orderBy: { id: "asc" },
  });
  res.json(branches);
});

// Получить информацию о бизнесе (публичная)
app.get("/api/public/business", getBusinessBySlug, async (req, res) => {
  const business = await prisma.business.findUnique({
    where: { id: req.business.id },
    select: {
      name: true
    },
    include: {
      branches: {
        take: 1,
        select: {
          address: true,
          phone: true
        }
      }
    }
  });
  
  const result = {
    name: business.name,
    address: business.branches[0]?.address || null,
    phone: business.branches[0]?.phone || null
  };
  
  res.json(result);
});

// Создать услугу (защищенный)
app.post("/api/services", requireAuth, async (req, res) => {
  const { name, duration, price, categoryId } = req.body;

  if (!name || !duration || !price) {
    return res.status(400).json({ error: "Заполните все поля" });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user || !user.businessId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const service = await prisma.service.create({
    data: {
      name,
      duration: Number(duration),
      price: Number(price),
      categoryId: categoryId ? Number(categoryId) : null,
      businessId: user.businessId,
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

// Получить всех мастеров (для админки)
app.get("/api/masters", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user || !user.businessId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  
  const masters = await prisma.master.findMany({
    where: { businessId: user.businessId },
    orderBy: { id: "asc" },
  });
  res.json(masters);
});

// Получить всех мастеров (публичные)
app.get("/api/public/masters", getBusinessBySlug, async (req, res) => {
  const masters = await prisma.master.findMany({
    where: { businessId: req.business.id },
    orderBy: { id: "asc" },
  });
  res.json(masters);
});

// Создать мастера (защищенный)
app.post("/api/masters", requireAuth, async (req, res) => {
  const { name, active, role } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Имя обязательно" });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user || !user.businessId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const master = await prisma.master.create({
    data: {
      name: String(name),
      active: typeof active === "boolean" ? active : true,
      role: role ? String(role) : "MASTER",
      businessId: user.businessId,
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

// Получить работы (для админки)
app.get("/api/works", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user || !user.businessId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  
  const photos = await prisma.workPhoto.findMany({
    where: { businessId: user.businessId },
    orderBy: { id: "desc" },
  });
  res.json(photos);
});

// Получить работы (публичные)
app.get("/api/public/works", getBusinessBySlug, async (req, res) => {
  const photos = await prisma.workPhoto.findMany({
    where: { businessId: req.business.id },
    orderBy: { id: "desc" },
  });
  res.json(photos);
});

app.post("/api/works", worksUpload.single("image"), requireAuth, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Файл не выбран" });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user || !user.businessId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const imageUrl = `/uploads/works/${req.file.filename}`;
  const caption = req.body && req.body.caption ? String(req.body.caption) : null;

  const photo = await prisma.workPhoto.create({
    data: {
      imageUrl,
      caption,
      businessId: user.businessId,
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

app.get("/api/appointments", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user || !user.businessId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  
  const { from, to, masterId } = req.query;
  const where = { businessId: user.businessId };

  const fromDate = from ? parseDate(from) : null;
  const toDate = to ? parseDate(to) : null;

  if (fromDate || toDate) {
    where.startsAt = {};
    if (fromDate) where.startsAt.gte = fromDate;
    if (toDate) where.startsAt.lte = toDate;
  }
  if (masterId) where.staffId = Number(masterId);

  const items = await prisma.appointment.findMany({
    where,
    orderBy: { startsAt: "asc" },
    include: { service: true, staff: true, branch: true },
  });

  res.json(items);
});

// Получить записи (публичные)
app.get("/api/public/appointments", getBusinessBySlug, async (req, res) => {
  const { from, to, masterId } = req.query;
  const where = { businessId: req.business.id };

  const fromDate = from ? parseDate(from) : null;
  const toDate = to ? parseDate(to) : null;

  if (fromDate || toDate) {
    where.startsAt = {};
    if (fromDate) where.startsAt.gte = fromDate;
    if (toDate) where.startsAt.lte = toDate;
  }
  if (masterId) where.staffId = Number(masterId);

  const items = await prisma.appointment.findMany({
    where,
    orderBy: { startsAt: "asc" },
    include: { service: true, staff: true, branch: true },
  });

  res.json(items);
});

app.post("/api/public/appointments", getBusinessBySlug, async (req, res) => {
  const { customerName, customerPhone, startsAt, serviceId, staffId, branchId } = req.body;

  if (!customerName || !startsAt || !serviceId || !staffId) {
    return res.status(400).json({ error: "Заполните клиента, услугу, мастера и время" });
  }

  const start = parseDate(startsAt);
  if (!start) {
    return res.status(400).json({ error: "Некорректная дата" });
  }

  const service = await prisma.service.findFirst({ where: { id: Number(serviceId), businessId: req.business.id } });
  if (!service) {
    return res.status(400).json({ error: "Услуга не найдена" });
  }

  const durationMs = Number(service.duration) * 60 * 1000;
  const end = new Date(start.getTime() + durationMs);

  const sid = Number(staffId);
  const overlap = await prisma.appointment.findFirst({
    where: {
      businessId: req.business.id,
      staffId: sid,
      AND: [{ startsAt: { lt: end } }, { endsAt: { gt: start } }],
    },
  });
  if (overlap) {
    return res.status(409).json({ error: "У мастера уже есть запись на это время" });
  }

  const item = await prisma.appointment.create({
    data: {
      businessId: req.business.id,
      customerName: String(customerName),
      customerPhone: customerPhone ? String(customerPhone) : null,
      startsAt: start,
      endsAt: end,
      priceAtBooking: Number(service.price),
      serviceId: Number(serviceId),
      staffId: sid,
      branchId: branchId ? Number(branchId) : null,
    },
    include: { service: true, staff: true, branch: true },
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
