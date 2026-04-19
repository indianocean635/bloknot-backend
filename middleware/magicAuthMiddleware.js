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
        user = await prisma.user.create({
          data: {
            email: userEmail.toLowerCase(),
            role: 'owner',
            createdAt: new Date()
          },
          include: { business: true }
        });
        console.log(`[MAGIC_AUTH] Created new user: ${userEmail}`);
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
      const business = await prisma.business.create({
        data: {
          name: `${user.email}'s Business`,
          ownerId: user.id,
          slug: user.email.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase(),
          createdAt: new Date()
        }
      });
      
      // Update user with businessId
      await prisma.user.update({
        where: { id: user.id },
        data: { businessId: business.id }
      });
      
      req.business = business;
    } else {
      req.business = user.business;
    }
    
    next();
  } catch (error) {
    console.error("Error getting business:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Simple middleware that doesn't require authentication (for testing)
function optionalAuth(req, res, next) {
  // For now, just pass through
  next();
}

module.exports = {
  requireMagicAuth,
  getBusinessFromUser,
  optionalAuth
};
