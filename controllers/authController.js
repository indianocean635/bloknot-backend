const { prisma } = require("../services/prismaService");
const jwt = require("jsonwebtoken");

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
    if (i > 0) {
      const key = part.slice(0, i).trim();
      const value = part.slice(i + 1).trim();
      out[key] = value;
    }
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

// Отправка magic link
async function sendMagicLink(req, res) {
  const { email } = req.body;
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return res.status(400).json({ error: "Email required" });

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
      return res.status(404).json({ error: "User not found" });
    }
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "15m" });
  const magicLink = `${process.env.BASE_URL || "http://localhost:3001"}/magic/${token}`;

  // TODO: Send email
  console.log("Magic link:", magicLink);

  res.json({ message: "Magic link sent" });
}

// Вход по magic link
async function loginWithMagicLink(req, res) {
  const { token } = req.params;
  if (!token) return res.status(400).json({ error: "Token required" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const sessionToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "90d" });
    setAuthCookie(res, sessionToken);

    res.json({ user: { id: user.id, email: user.email, role: user.role } });
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// Выход
async function logout(req, res) {
  clearAuthCookie(res);
  res.json({ message: "Logged out" });
}

// Получить текущего пользователя
async function getCurrentUser(req, res) {
  const user = await prisma.user.findUnique({ 
    where: { id: req.user.id },
    include: { business: true }
  });
  
  if (!user) return res.status(404).json({ error: "User not found" });
  
  res.json({ user });
}

module.exports = {
  sendMagicLink,
  loginWithMagicLink,
  logout,
  getCurrentUser
};
