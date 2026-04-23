const { prisma } = require("../services/prismaService");

// Middleware for magic link authentication (localStorage based)
function requireMagicAuth(req, res, next) {
  // For now, we'll accept any request and get user by email from headers
  // In production, this should be more secure
  const userEmail = req.headers['x-user-email'] || req.headers['x-email'];
  
  if (!userEmail) {
    return res.status(401).json({ error: "Unauthorized - No email provided" });
  }
  
  // Find user by email, or create if not found
  prisma.user.findUnique({
    where: { email: userEmail.toLowerCase() },
    include: { business: true }
  })
  .then(async user => {
    if (!user) {
      // Create user if not found
      try {
        // Create business first
        const slug = userEmail.toLowerCase().replace('@', '-').replace('.', '-');
        const business = await prisma.business.create({
          data: {
            name: `${userEmail}'s Business`,
            slug: slug,
            owner: {
              create: {
                email: userEmail.toLowerCase(),
                role: 'owner',
                createdAt: new Date()
              }
            }
          },
          include: { owner: true }
        });
        
        user = business.owner;
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
          owner: {
            connect: {
              id: user.id
            }
          }
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

module.exports = {
  requireMagicAuth,
  getBusinessFromUser,
  adminAuth,
  optionalAuth
};
