const express = require("express");
const nodemailer = require("nodemailer");
const { prisma } = require("../services/prismaService");
const { requireMagicAuth, getBusinessFromUser } = require("../middleware/magicAuthMiddleware");
const router = express.Router();

// Middleware mock for testing without authentication
router.use((req, res, next) => {
  req.business = req.business || { id: "1" };
  next();
});

// Email transporter (Yandex SMTP) - same as in authRoutes
let transporter = null;

// Initialize email transporter
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  console.log('SettingsRoutes: Email transporter configured with Yandex SMTP');
} else {
  console.log('SettingsRoutes: Email not configured - missing SMTP settings');
}

// Get business settings
router.get("/business", async (req, res) => {
  try {
    const business = await prisma.business.findUnique({
      where: { id: req.business.id },
      include: {
        branches: true,
        categories: {
          include: { services: true }
        },
        masters: true,
        workPhotos: {
          where: { isLogo: true }
        }
      }
    });
    
    res.json(business);
  } catch (error) {
    console.error("Error getting business:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get business name
router.get("/business/name", async (req, res) => {
  try {
    const business = await prisma.business.findUnique({
      where: { id: req.business.id },
      select: { name: true }
    });
    
    res.json(business);
  } catch (error) {
    console.error("Error getting business name:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update business name
router.patch("/business/name", async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Business name is required" });
    }
    
    const business = await prisma.business.update({
      where: { id: req.business.id },
      data: { name: name.trim() }
    });
    
    res.json(business);
  } catch (error) {
    console.error("Error updating business name:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get branches
router.get("/branches", async (req, res) => {
  try {
    const branches = await prisma.branch.findMany({
      where: { businessId: req.business.id },
      orderBy: { createdAt: 'asc' }
    });
    
    res.json(branches);
  } catch (error) {
    console.error("Error getting branches:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create branch
router.post("/branches", async (req, res) => {
  try {
    const { name, address, phone } = req.body;
    
    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Branch name is required" });
    }
    
    const branch = await prisma.branch.create({
      data: {
        name: name.trim(),
        address: address?.trim() || "",
        phone: phone?.trim() || "",
        businessId: req.business.id
      }
    });
    
    res.json(branch);
  } catch (error) {
    console.error("Error creating branch:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update branch
router.patch("/branches/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, phone } = req.body;
    
    const branch = await prisma.branch.findFirst({
      where: { 
        id: parseInt(id),
        businessId: req.business.id 
      }
    });
    
    if (!branch) {
      return res.status(404).json({ error: "Branch not found" });
    }
    
    const updatedBranch = await prisma.branch.update({
      where: { id: parseInt(id) },
      data: {
        name: name?.trim() || branch.name,
        address: address?.trim() || branch.address,
        phone: phone?.trim() || branch.phone
      }
    });
    
    res.json(updatedBranch);
  } catch (error) {
    console.error("Error updating branch:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete branch
router.delete("/branches/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const branch = await prisma.branch.findFirst({
      where: { 
        id: parseInt(id),
        businessId: req.business.id 
      }
    });
    
    if (!branch) {
      return res.status(404).json({ error: "Branch not found" });
    }
    
    await prisma.branch.delete({
      where: { id: parseInt(id) }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting branch:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get categories
router.get("/categories", async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      where: { businessId: req.business.id },
      include: { services: true },
      orderBy: { name: 'asc' }
    });
    
    res.json(categories);
  } catch (error) {
    console.error("Error getting categories:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create category
router.post("/categories", async (req, res) => {
  try {
    const { name, color } = req.body;
    
    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Category name is required" });
    }
    
    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        color: color || "#000000",
        businessId: req.business.id
      }
    });
    
    res.json(category);
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update category
router.patch("/categories/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;
    
    const category = await prisma.category.findFirst({
      where: { 
        id: parseInt(id),
        businessId: req.business.id 
      }
    });
    
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }
    
    const updatedCategory = await prisma.category.update({
      where: { id: parseInt(id) },
      data: {
        name: name?.trim() || category.name,
        color: color || category.color
      }
    });
    
    res.json(updatedCategory);
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete category
router.delete("/categories/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const category = await prisma.category.findFirst({
      where: { 
        id: parseInt(id),
        businessId: req.business.id 
      }
    });
    
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }
    
    await prisma.category.delete({
      where: { id: parseInt(id) }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get services
router.get("/services", async (req, res) => {
  try {
    const services = await prisma.service.findMany({
      where: { businessId: req.business.id },
      include: { category: true },
      orderBy: { name: 'asc' }
    });
    
    res.json(services);
  } catch (error) {
    console.error("Error getting services:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create service
router.post("/services", async (req, res) => {
  try {
    const { name, duration, price, categoryId } = req.body;
    
    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Service name is required" });
    }
    
    if (!duration || duration <= 0) {
      return res.status(400).json({ error: "Duration must be greater than 0" });
    }
    
    if (!price || price <= 0) {
      return res.status(400).json({ error: "Price must be greater than 0" });
    }
    
    const service = await prisma.service.create({
      data: {
        name: name.trim(),
        duration: parseInt(duration),
        price: parseFloat(price),
        categoryId: categoryId ? parseInt(categoryId) : null,
        businessId: req.business.id
      },
      include: { category: true }
    });
    
    res.json(service);
  } catch (error) {
    console.error("Error creating service:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update service
router.patch("/services/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, duration, price, categoryId } = req.body;
    
    const service = await prisma.service.findFirst({
      where: { 
        id: parseInt(id),
        businessId: req.business.id 
      }
    });
    
    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }
    
    const updatedService = await prisma.service.update({
      where: { id: parseInt(id) },
      data: {
        name: name?.trim() || service.name,
        duration: duration ? parseInt(duration) : service.duration,
        price: price ? parseFloat(price) : service.price,
        categoryId: categoryId ? parseInt(categoryId) : service.categoryId
      },
      include: { category: true }
    });
    
    res.json(updatedService);
  } catch (error) {
    console.error("Error updating service:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete service
router.delete("/services/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const service = await prisma.service.findFirst({
      where: { 
        id: parseInt(id),
        businessId: req.business.id 
      }
    });
    
    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }
    
    await prisma.service.delete({
      where: { id: parseInt(id) }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting service:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get masters
router.get("/masters", async (req, res) => {
  try {
    const masters = await prisma.master.findMany({
      where: { businessId: req.business.id },
      orderBy: { name: 'asc' }
    });
    
    res.json(masters);
  } catch (error) {
    console.error("Error getting masters:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create master
router.post("/masters", async (req, res) => {
  try {
    const { name, email } = req.body;
    
    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Master name is required" });
    }
    
    if (!email || email.trim() === "") {
      return res.status(400).json({ error: "Master email is required" });
    }
    
    const master = await prisma.master.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        active: true,
        businessId: req.business.id
      }
    });
    
    res.json(master);
  } catch (error) {
    console.error("Error creating master:", error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: "Email already exists" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update master
router.patch("/masters/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, active } = req.body;
    
    const master = await prisma.master.findFirst({
      where: { 
        id: parseInt(id),
        businessId: req.business.id 
      }
    });
    
    if (!master) {
      return res.status(404).json({ error: "Master not found" });
    }
    
    const updatedMaster = await prisma.master.update({
      where: { id: parseInt(id) },
      data: {
        name: name?.trim() || master.name,
        email: email?.trim().toLowerCase() || master.email,
        active: active !== undefined ? active : master.active
      }
    });
    
    res.json(updatedMaster);
  } catch (error) {
    console.error("Error updating master:", error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: "Email already exists" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete master
router.delete("/masters/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const master = await prisma.master.findFirst({
      where: { 
        id: parseInt(id),
        businessId: req.business.id 
      }
    });
    
    if (!master) {
      return res.status(404).json({ error: "Master not found" });
    }
    
    await prisma.master.delete({
      where: { id: parseInt(id) }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting master:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get works
router.get("/works", async (req, res) => {
  try {
    const works = await prisma.workPhoto.findMany({
      where: { businessId: req.business.id },
      orderBy: { id: "desc" }
    });

    const transformedWorks = works.map(work => ({
      id: work.id,
      url: work.imageUrl,
      description: work.caption,
      isLogo: work.isLogo,
      createdAt: work.createdAt
    }));

    res.json(transformedWorks);
  } catch (error) {
    console.error("Error getting works:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Invite specialist
router.post("/invite-specialist", async (req, res) => {
  try {
    const { email, name, businessName, businessId, inviteLink, message } = req.body;
    
    if (!email || !name) {
      return res.status(400).json({ error: "Email and name are required" });
    }

    // Create specialist invitation record
    const specialist = await prisma.master.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        active: false, // Inactive until invitation is accepted
        businessId: req.business.id
      }
    });

    // Send invitation email if transporter is available
    if (transporter) {
      const mailOptions = {
        from: `"${businessName || 'Bloknot'}" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `Приглашение присоединиться к ${businessName || 'Bloknot'}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Приглашение присоединиться к команде</h2>
            <p>Здравствуйте, ${name}!</p>
            <p>${message || 'Вас пригласили присоединиться к нашей команде в ' + (businessName || 'Bloknot') + '.'}</p>
            <p>Для принятия приглашения, пожалуйста, перейдите по ссылке ниже:</p>
            <p><a href="${inviteLink || '#'}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Принять приглашение</a></p>
            <p>Если вы не хотите принимать это приглашение, просто проигнорируйте это письмо.</p>
            <p>С уважением,<br>Команда ${businessName || 'Bloknot'}</p>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
    }

    res.json({ 
      success: true, 
      specialist: specialist,
      message: transporter ? "Invitation sent successfully" : "Specialist created, but email not sent (SMTP not configured)"
    });
  } catch (error) {
    console.error("Error inviting specialist:", error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: "Email already exists" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
