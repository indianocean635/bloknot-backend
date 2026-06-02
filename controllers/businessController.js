const { prisma } = require("../services/prismaService");

// Generate random short slug
function generateShortSlug() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let slug = '';
  for (let i = 0; i < 8; i++) {
    slug += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return slug;
}

// Получить бизнес по slug
async function getBusinessBySlug(req, res) {
  const { slug } = req.params;

  console.log('[PUBLIC API] getBusinessBySlug called with slug:', slug);

  if (!slug || slug === 'undefined' || slug === '') {
    console.log('[PUBLIC API] Invalid slug provided');
    return res.status(400).json({ 
      error: "Invalid slug parameter",
      message: "Slug is required. Please provide a valid business slug in the URL parameter."
    });
  }

  const business = await prisma.business.findUnique({
    where: { slug }
  });

  console.log('[PUBLIC API] Business found:', business ? 'YES' : 'NO');
  if (business) {
    console.log('[PUBLIC API] Business details:', {
      id: business.id,
      name: business.name,
      slug: business.slug,
      ownerId: business.ownerId
    });
  }

  if (!business) return res.status(404).json({ error: "Business not found" });

  // Get services with categories
  const services = await prisma.service.findMany({
    where: { businessId: business.id },
    include: {
      category: true
    }
  });

  console.log('[PUBLIC API] Services loaded:', services.length);

  // Get categories
  const categories = await prisma.category.findMany({
    where: { businessId: business.id }
  });

  console.log('[PUBLIC API] Categories loaded:', categories.length);

  // Get masters with schedules, categoryIds, and serviceIds
  // Filter by branch if branchId is provided in query
  const branchFilter = {};
  if (req.query.branchId) {
    branchFilter.branchId = parseInt(req.query.branchId);
  }

  const masters = await prisma.master.findMany({
    where: { 
      businessId: business.id,
      ...branchFilter
    },
    select: {
      id: true,
      name: true,
      specializations: true,
      avatarUrl: true,
      branchId: true,
      schedule: true,
      categoryIds: true,
      serviceIds: true,
      active: true,
      schedules: true
    }
  });

  console.log('[PUBLIC API] Masters loaded:', masters.length);

  // Get branches
  const branches = await prisma.branch.findMany({
    where: { businessId: business.id }
  });

  console.log('[PUBLIC API] Branches loaded:', branches.length);

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

  // Get work photos (non-logo)
  const workPhotos = await prisma.workPhoto.findMany({
    where: {
      businessId: business.id,
      isLogo: false
    }
  });

  console.log('[PUBLIC API] Work photos loaded:', workPhotos.length);

  const result = {
    business: {
      id: business.id,
      name: business.name,
      slug: business.slug,
      logo: logoPhoto?.imageUrl || null,
      description: business.description || null
    },
    services: services,
    categories: categories,
    masters: masters,
    branches: branches,
    workPhotos: workPhotos
  };

  console.log('[PUBLIC API] Final result structure:', {
    hasBusiness: !!result.business,
    hasServices: result.services.length > 0,
    hasCategories: result.categories.length > 0,
    hasMasters: result.masters.length > 0,
    hasBranches: result.branches.length > 0
  });
  
  res.json(result);
}

// Получить филиалы
async function getBranches(req, res) {
  const branches = await prisma.branch.findMany({
    where: { businessId: req.user.businessId },
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
    where: { businessId: req.user.businessId },
    orderBy: { id: "asc" },
    include: { category: true },
  });
  
  res.json(services);
}

// Получить мастеров
async function getMasters(req, res) {
  const masters = await prisma.master.findMany({
    where: { businessId: req.user.businessId },
    orderBy: { id: "asc" }
  });
  
  res.json(masters);
}

// Получить работы (фото)
async function getWorks(req, res) {
  const works = await prisma.workPhoto.findMany({
    where: { businessId: req.user.businessId },
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
  try {
    console.log('[REQUEST]', {
      userId: req.user?.id,
      businessId: req.user?.businessId,
      route: req.originalUrl
    });

    const user = req.user;
    
    if (!user || !user.businessId) {
      console.warn('[SECURITY] Missing user or businessId', { userId: req.user?.id, businessId: req.user?.businessId });
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
  } catch (error) {
    console.error("Error getting business name:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Обновить название компании
async function updateBusinessName(req, res) {
  try {
    console.log('[REQUEST]', {
      userId: req.user?.id,
      businessId: req.user?.businessId,
      route: req.originalUrl
    });

    const user = req.user;
    
    if (!user || !user.businessId) {
      console.warn('[SECURITY] Missing user or businessId', { userId: req.user?.id, businessId: req.user?.businessId });
      return res.status(403).json({ error: "Forbidden" });
    }

    const { name } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: "Название обязательно" });
    }
    
    const business = await prisma.business.update({
      where: { id: user.businessId },
      data: { name: name.trim() }
    });
    
    res.json({ name: business.name });
  } catch (error) {
    console.error("Error updating business name:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Find business by email for booking page
async function getBusinessByEmail(req, res) {
  const { email } = req.params;

  const user = await prisma.user.findUnique({
    where: { email: email }
  });

  if (!user) return res.status(404).json({ error: "User not found" });

  const business = await prisma.business.findFirst({
    where: {
      ownerId: user.id
    }
  });

  if (!business) return res.status(404).json({ error: "Business not found" });

  // Get services with categories
  const services = await prisma.service.findMany({
    where: { businessId: business.id },
    include: {
      category: true
    }
  });

  console.log('Services loaded for business', business.id, ':', services);
  console.log('Services count:', services.length);

  // Get categories
  const categories = await prisma.category.findMany({
    where: { businessId: business.id }
  });

  // Get masters with schedules, categoryIds, and serviceIds
  const masters = await prisma.master.findMany({
    where: { businessId: business.id },
    select: {
      id: true,
      name: true,
      specializations: true,
      avatarUrl: true,
      branchId: true,
      schedule: true,
      categoryIds: true,
      serviceIds: true,
      active: true,
      schedules: true
    }
  });

  // Get branches
  const branches = await prisma.branch.findMany({
    where: { businessId: business.id }
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

  // Get work photos (non-logo)
  const workPhotos = await prisma.workPhoto.findMany({
    where: {
      businessId: business.id,
      isLogo: false
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
    categories: categories,
    masters: masters,
    branches: branches,
    workPhotos: workPhotos
  };

  console.log('Business data for booking:', result);
  res.json(result);
}

// Get user's business
async function getBusiness(req, res) {
  try {
    console.log('[REQUEST]', {
      userId: req.user?.id,
      businessId: req.user?.businessId,
      route: req.originalUrl
    });

    const user = req.user;
    
    if (!user) {
      console.warn('[SECURITY] Missing user', { userId: req.user?.id });
      return res.status(401).json({ error: 'User not found' });
    }
    
    // Check if user has a business
    if (!user.businessId) {
      console.warn('[SECURITY] Missing businessId', { userId: user.id });
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
  try {
    console.log('[REQUEST]', {
      userId: req.user?.id,
      businessId: req.user?.businessId,
      route: req.originalUrl
    });

    const user = req.user;
    
    if (!user) {
      console.warn('[SECURITY] Missing user', { userId: req.user?.id });
      return res.status(401).json({ error: 'User not found' });
    }

    const { name, phone, address, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: "Business name is required" });
    }
    
    // Check if user already has a business
    if (user.businessId) {
      return res.status(400).json({ error: "User already has a business" });
    }
    
    // Generate unique short slug
    let slug;
    let attempts = 0;
    const maxAttempts = 10;
    
    do {
      slug = generateShortSlug();
      attempts++;
      const existing = await prisma.business.findUnique({ where: { slug } });
      if (!existing) break;
    } while (attempts < maxAttempts);
    
    if (attempts >= maxAttempts) {
      return res.status(500).json({ error: "Failed to generate unique slug" });
    }
    
    // Create business with owner
    const business = await prisma.business.create({
      data: {
        name: name,
        slug: slug,
        ownerId: user.id
      }
    });
    
    // Update user with businessId
    await prisma.user.update({
      where: { id: user.id },
      data: { businessId: business.id }
    });
    
    console.log(`Created business for ${user.email}:`, business);
    
    res.status(201).json(business);
  } catch (error) {
    console.error("Error creating business:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Update business
async function updateBusiness(req, res) {
  try {
    console.log('[REQUEST]', {
      userId: req.user?.id,
      businessId: req.user?.businessId,
      route: req.originalUrl
    });

    const user = req.user;
    
    if (!user) {
      console.warn('[SECURITY] Missing user', { userId: req.user?.id });
      return res.status(401).json({ error: 'User not found' });
    }

    const { name, phone, address, description } = req.body;
    
    // Check if user has a business
    if (!user.businessId) {
      console.warn('[SECURITY] Missing businessId', { userId: user.id });
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
    
    console.log(`Updated business for ${user.email}:`, business);
    
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
