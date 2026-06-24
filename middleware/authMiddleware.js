const jwt = require("jsonwebtoken");
const { prisma } = require("../services/prismaService");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_COOKIE_NAME = "auth";
const IS_PROD = process.env.NODE_ENV === "production";

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

function getJwtUser(req, cookieName) {
  if (!JWT_SECRET) return null;
  
  // Try Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Check if token contains HTML (possible error page)
    if (token.includes('<') || token.includes('html')) {
      console.log('[AUTH] Token contains HTML, rejecting');
      return null;
    }
    
    console.log('[AUTH] Token from Authorization header:', token.substring(0, 20) + '...');
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (!payload || typeof payload !== "object") return null;
      const userId = payload.userId;
      if (typeof userId !== "string" || !userId) return null;
      console.log('[AUTH] User from Authorization header:', userId);
      return { id: userId };
    } catch (e) {
      console.log('[AUTH] Failed to verify Authorization header token:', e.message);
    }
  }
  
  // Fall back to cookie
  const cookies = parseCookies(req);
  const token = cookies[cookieName];
  if (!token) {
    console.log('[AUTH] No token in Authorization header or cookie');
    return null;
  }
  
  // Check if token contains HTML (possible error page)
  if (token.includes('<') || token.includes('html')) {
    console.log('[AUTH] Cookie token contains HTML, rejecting');
    return null;
  }
  
  console.log('[AUTH] Token from cookie:', token.substring(0, 20) + '...');
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload || typeof payload !== "object") return null;
    const userId = payload.userId;
    if (typeof userId !== "string" || !userId) return null;
    console.log('[AUTH] User from cookie:', userId);
    return { id: userId };
  } catch (e) {
    console.log('[AUTH] Failed to verify cookie token:', e.message);
    return null;
  }
}

function getAuthUser(req) {
  return getJwtUser(req, JWT_COOKIE_NAME);
}

async function requireAuth(req, res, next) {
  // Check for impersonation cookie first
  const cookies = parseCookies(req);
  const impersonateEmail = cookies.impersonate;
  
  let fullUser;
  if (impersonateEmail) {
    // Get impersonated user data
    console.log('[IMPERSONATION] Impersonating user:', impersonateEmail);
    // Decode URL-encoded email
    const decodedEmail = decodeURIComponent(impersonateEmail);
    console.log('[IMPERSONATION] Decoded email:', decodedEmail);
    fullUser = await prisma.user.findUnique({
      where: { email: decodedEmail },
      include: { business: true }
    });
    if (!fullUser) return res.status(401).json({ error: "User not found" });
    
    req.user = {
      id: fullUser.id,
      email: fullUser.email,
      name: fullUser.name,
      phone: fullUser.phone,
      role: fullUser.role,
      businessId: fullUser.businessId,
      business: fullUser.business,
      isImpersonated: true
    };
  } else {
    // Normal JWT authentication
    const user = getAuthUser(req);
    if (!user) {
      console.log('[AUTH] No user found in token');
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    // Check if token contains HTML (possible error page)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.includes('<')) {
      console.log('[AUTH] Token contains HTML, possible error page');
      return res.status(401).json({ error: "Invalid token format" });
    }
    
    fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { business: true }
    });
    
    if (!fullUser) {
      console.log('[AUTH] User not found in database:', user.id);
      return res.status(401).json({ error: "User not found" });
    }
    
    req.user = {
      id: fullUser.id,
      email: fullUser.email,
      name: fullUser.name,
      phone: fullUser.phone,
      role: fullUser.role,
      businessId: fullUser.businessId,
      business: fullUser.business,
      isImpersonated: false
    };
    
    console.log('[AUTH] User authenticated successfully:', { 
      id: fullUser.id, 
      email: fullUser.email, 
      role: fullUser.role 
    });
  }
  
  console.log('AUTH USER:', req.user);
  next();
}

async function getBusinessBySlugMiddleware(req, res, next) {
  const slug = req.params.slug || req.query.slug;
  console.log('getBusinessBySlugMiddleware called with slug:', slug);
  console.log('req.params:', req.params);
  console.log('req.query:', req.query);
  
  if (!slug) return res.status(400).json({ error: "Slug required" });
  
  const business = await prisma.business.findUnique({ where: { slug } });
  if (!business) return res.status(404).json({ error: "Business not found" });
  
  console.log('Business found:', business.id, business.name);
  req.business = business;
  next();
}

// Middleware for admin and sales staff access
async function requireAdminOrSalesStaff(req, res, next) {
  await requireAuth(req, res, () => {
    if (!req.user || (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'SALES_STAFF')) {
      console.warn('[SECURITY] Unauthorized access attempt', { userId: req.user?.id, role: req.user?.role });
      return res.status(403).json({ error: 'Forbidden - Admin or Sales Staff access required' });
    }
    next();
  });
}

module.exports = {
  requireAuth,
  getBusinessBySlug: getBusinessBySlugMiddleware,
  getAuthUser,
  requireAdminOrSalesStaff
};
