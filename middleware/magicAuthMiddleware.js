const { prisma } = require("../services/prismaService");

// Middleware for magic link authentication (JWT cookie based)
function requireMagicAuth(req, res, next) {
  const jwt = require('jsonwebtoken');

  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: 'No token' });
  }

  let payload;

  try {
    payload = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  // Find user by ID from JWT payload
  prisma.user.findUnique({
    where: { id: payload.userId },
    include: { business: true }
  })
  .then(async user => {
    if (!user) {
      // Create user if not found
      try {
        // Create user first
        const user = await prisma.user.create({
          data: {
            email: payload.email.toLowerCase(),
            role: 'owner',
            createdAt: new Date()
          }
        });
        
        // Create business for user
        const slug = payload.email.toLowerCase().replace('@', '-').replace('.', '-');
        const business = await prisma.business.create({
          data: {
            name: `${payload.email}'s Business`,
            slug: slug,
            ownerId: user.id
          },
          include: { owner: true }
        });
        
        // Update user with businessId
        await prisma.user.update({
          where: { id: user.id },
          data: { businessId: business.id }
        });
        console.log(`[MAGIC_AUTH] Created new user with business: ${userEmail}`);
        console.log(`[MAGIC_AUTH] Business ID: ${business.id}, User ID: ${user.id}`);
      } catch (createError) {
        console.error(`[MAGIC_AUTH] Failed to create user ${userEmail}:`, createError);
        return res.status(401).json({ error: "Unauthorized - Failed to create user" });
      }
    }
    
    req.user = { 
      email: user.email, 
      id: user.id,
      businessId: user.businessId,
      role: user.role
    };
    if (user.business) {
      req.business = user.business;
      req.user.businessId = user.business.id;
    }
    
    next();
  })
  .catch(error => {
    console.error("Auth middleware error:", error);
    res.status(500).json({ error: "Internal server error" });
  });
}

// Middleware to get business from authenticated user
async function getBusinessFromUser(req, res, next) {
  try {
    if (!req.user || !req.user.email) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const user = await prisma.user.findUnique({
      where: { email: req.user.email },
      include: { business: true }
    });
    
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }
    
    // Create business if not exists
    if (!user.business) {
      console.log(`[GET_BUSINESS] Creating business for user: ${user.email}`);
      const slug = user.email.toLowerCase().replace('@', '-').replace('.', '-');
      const business = await prisma.business.create({
        data: {
          name: `${user.email}'s Business`,
          slug: slug,
          ownerId: user.id
        }
      });
      
      // Update user with businessId
      await prisma.user.update({
        where: { id: user.id },
        data: { businessId: business.id }
      });
      
      user.business = business;
      user.businessId = business.id;
      console.log(`[GET_BUSINESS] Created business: ${business.id} for user: ${user.email}`);
    }
    
    req.business = user.business;
    next();
  } catch (error) {
    console.error("Error getting business:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Admin authentication middleware (for admin panel)
function adminAuth(req, res, next) {
  // Check for admin authentication via headers or localStorage simulation
  const adminEmail = req.headers['x-admin-email'] || req.headers['x-user-email'];
  const adminLoggedIn = req.headers['x-admin-logged-in'] || req.headers['x-user-email'];
  
  console.log(`[ADMIN_AUTH] Admin email: ${adminEmail}`);
  console.log(`[ADMIN_AUTH] Admin logged in: ${adminLoggedIn ? 'yes' : 'no'}`);
  
  // For now, allow any request with admin email or just pass through
  // In production, this should check against admin users
  if (adminEmail || adminLoggedIn) {
    req.adminEmail = adminEmail;
    return next();
  }
  
  // For testing, allow requests without strict auth
  console.log(`[ADMIN_AUTH] Allowing request without strict auth`);
  next();
}

// Simple middleware that doesn't require authentication (for testing)
function optionalAuth(req, res, next) {
  // For now, just pass through
  next();
}

// Middleware to get business by slug (for public endpoints)
async function getBusinessBySlug(req, res, next) {
  try {
    const slug = req.query.slug || req.params.slug;
    
    if (!slug) {
      return res.status(400).json({ error: "Business slug is required" });
    }
    
    const business = await prisma.business.findUnique({
      where: { slug: slug }
    });
    
    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }
    
    req.business = business;
    next();
  } catch (error) {
    console.error("Error getting business by slug:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = {
  requireMagicAuth,
  getBusinessFromUser,
  getBusinessBySlug,
  adminAuth,
  optionalAuth
};
