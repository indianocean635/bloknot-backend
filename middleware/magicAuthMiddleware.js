const { prisma } = require("../services/prismaService");

// Middleware for magic link authentication (localStorage based)
function requireMagicAuth(req, res, next) {
  // For now, we'll accept any request and get user by email from headers
  // In production, this should be more secure
  const userEmail = req.headers['x-user-email'] || req.headers['x-email'];
  
  if (!userEmail) {
    return res.status(401).json({ error: "Unauthorized - No email provided" });
  }
  
  // Find user by email
  prisma.user.findUnique({
    where: { email: userEmail.toLowerCase() },
    include: { business: true }
  })
  .then(user => {
    if (!user) {
      return res.status(401).json({ error: "Unauthorized - User not found" });
    }
    
    req.user = { email: user.email, id: user.id };
    if (user.business) {
      req.business = user.business;
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
    
    if (!user || !user.business) {
      return res.status(404).json({ error: "Business not found" });
    }
    
    req.business = user.business;
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
