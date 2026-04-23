const { prisma } = require("../services/prismaService");

// Получить бизнес по slug
async function getBusinessBySlug(req, res) {
  const { slug } = req.params;
  
  const business = await prisma.business.findUnique({
    where: { slug }
  });
  
  if (!business) return res.status(404).json({ error: "Business not found" });
  
  // Получаем логотип
  const logoPhoto = await prisma.workPhoto.findFirst({
    where: {
      businessId: business.id,
      isLogo: true
    },
    select: {
      imageUrl: true
    }
  });
  
  const businessData = await prisma.business.findUnique({
    where: { id: business.id },
    select: {
      name: true,
      branches: {
        take: 1,
        select: {
          address: true
        }
      }
    }
  });
  
  const result = {
    name: businessData.name,
    address: businessData.branches[0]?.address || null,
    logo: logoPhoto?.imageUrl || null
  };
  
  console.log('Business data:', result);
  res.json(result);
}

// Получить филиалы
async function getBranches(req, res) {
  const branches = await prisma.branch.findMany({
    where: { businessId: req.business.id },
    orderBy: { id: "asc" }
  });
  
  res.json(branches.map(b => ({
    id: b.id,
    name: b.name,
    address: b.address,
    phone: b.phone,
    description: b.description
  })));
}

// Получить услуги
async function getServices(req, res) {
  const services = await prisma.service.findMany({
    where: { businessId: req.business.id },
    orderBy: { id: "asc" },
    include: { category: true },
  });
  
  res.json(services);
}

// Получить мастеров
async function getMasters(req, res) {
  const masters = await prisma.master.findMany({
    where: { businessId: req.business.id },
    orderBy: { id: "asc" }
  });
  
  res.json(masters);
}

// Получить работы (фото)
async function getWorks(req, res) {
  const works = await prisma.workPhoto.findMany({
    where: { businessId: req.business.id },
    orderBy: { id: "desc" }
  });
  
  res.json(works.map(work => ({
    id: work.id,
    url: work.imageUrl,
    description: work.caption,
    type: work.imageUrl.toLowerCase().includes('.mp4') || work.imageUrl.toLowerCase().includes('.mov') ? 'video' : 'image',
    isLogo: work.isLogo,
    createdAt: work.createdAt
  })));
}

// Получить название// Get business slug for booking link
async function getBusinessName(req, res) {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  
  if (!user || !user.businessId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  
  const business = await prisma.business.findUnique({ 
    where: { id: user.businessId }
  });
  
  if (!business) {
    return res.status(404).json({ error: "Business not found" });
  }
  
  // Return slug for booking link generation
  res.json({ slug: business.slug });
}

// Обновить название компании
async function updateBusinessName(req, res) {
  const { name } = req.body;
  
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: "Название обязательно" });
  }
  
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  
  if (!user || !user.businessId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  
  const business = await prisma.business.update({
    where: { id: user.businessId },
    data: { name: name.trim() }
  });
  
  res.json({ name: business.name });
}

// Find business by email for booking page
async function getBusinessByEmail(req, res) {
  const { email } = req.params;
  
  const business = await prisma.business.findFirst({
    where: {
      owner: {
        email: email
      }
    }
  });
  
  if (!business) return res.status(404).json({ error: "Business not found" });
  
  // Get services
  const services = await prisma.service.findMany({
    where: { businessId: business.id },
    select: {
      id: true,
      name: true,
      duration: true,
      price: true
    }
  });
  
  // Get masters
  const masters = await prisma.master.findMany({
    where: { businessId: business.id },
    select: {
      id: true,
      name: true
    }
  });
  
  // Get logo
  const logoPhoto = await prisma.workPhoto.findFirst({
    where: {
      businessId: business.id,
      isLogo: true
    },
    select: {
      imageUrl: true
    }
  });
  
  const result = {
    business: {
      id: business.id,
      name: business.name,
      slug: business.slug,
      logo: logoPhoto?.imageUrl || null
    },
    services: services,
    masters: masters
  };
  
  console.log('Business data for booking:', result);
  res.json(result);
}

// Get user's business
async function getBusiness(req, res) {
  const userEmail = req.cookies?.impersonate || req.headers['x-user-email'];
  
  if (!userEmail) {
    return res.status(401).json({ error: "No email provided" });
  }
  
  try {
    // Find user first
    const user = await prisma.user.findUnique({
      where: { email: userEmail }
    });
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Check if user has a business
    if (!user.businessId) {
      return res.status(404).json({ error: "Business not found" });
    }
    
    // Get business details
    const business = await prisma.business.findUnique({
      where: { id: user.businessId }
    });
    
    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }
    
    res.json(business);
  } catch (error) {
    console.error("Error getting business:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Create new business
async function createBusiness(req, res) {
  const userEmail = req.cookies?.impersonate || req.headers['x-user-email'];
  
  if (!userEmail) {
    return res.status(401).json({ error: "No email provided" });
  }
  
  try {
    const { name, phone, address, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: "Business name is required" });
    }
    
    // Find user first
    const user = await prisma.user.findUnique({
      where: { email: userEmail }
    });
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Check if user already has a business
    if (user.businessId) {
      return res.status(400).json({ error: "User already has a business" });
    }
    
    // Create slug from email
    const slug = userEmail.replace('@', '-').replace('.', '-');
    
    // Create business with owner
    const business = await prisma.business.create({
      data: {
        name: name,
        slug: slug,
        ownerId: user.id,
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
    
    console.log(`Created business for ${userEmail}:`, business);
    
    res.status(201).json(business);
  } catch (error) {
    console.error("Error creating business:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Update business
async function updateBusiness(req, res) {
  const userEmail = req.cookies?.impersonate || req.headers['x-user-email'];
  
  if (!userEmail) {
    return res.status(401).json({ error: "No email provided" });
  }
  
  try {
    const { name, phone, address, description } = req.body;
    
    // Find user first
    const user = await prisma.user.findUnique({
      where: { email: userEmail }
    });
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Check if user has a business
    if (!user.businessId) {
      return res.status(404).json({ error: "Business not found" });
    }
    
    // Update business
    const business = await prisma.business.update({
      where: { id: user.businessId },
      data: {
        ...(name && { name }),
        ...(phone && { phone }),
        ...(address && { address }),
        ...(description && { description })
      }
    });
    
    console.log(`Updated business for ${userEmail}:`, business);
    
    res.json(business);
  } catch (error) {
    console.error("Error updating business:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = {
  getBusinessBySlug,
  getBranches,
  getServices,
  getMasters,
  getWorks,
  getBusinessName,
  updateBusinessName,
  getBusinessByEmail,
  getBusiness,
  createBusiness,
  updateBusiness
};
