const express = require("express");
const { prisma } = require("../services/prismaService");
const { requireMagicAuth, getBusinessFromUser } = require("../middleware/magicAuthMiddleware");
const router = express.Router();

// Get business settings
router.get("/business", requireMagicAuth, getBusinessFromUser, async (req, res) => {
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

// Update business name
router.patch("/business/name", requireMagicAuth, getBusinessFromUser, async (req, res) => {
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
router.get("/branches", requireMagicAuth, getBusinessFromUser, async (req, res) => {
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
router.post("/branches", requireMagicAuth, getBusinessFromUser, async (req, res) => {
  try {
    const { name, address } = req.body;
    
    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Branch name is required" });
    }
    
    const branch = await prisma.branch.create({
      data: {
        name: name.trim(),
        address: address?.trim() || null,
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
router.patch("/branches/:id", requireMagicAuth, getBusinessFromUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address } = req.body;
    
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
        address: address?.trim() || branch.address
      }
    });
    
    res.json(updatedBranch);
  } catch (error) {
    console.error("Error updating branch:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete branch
router.delete("/branches/:id", requireMagicAuth, getBusinessFromUser, async (req, res) => {
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
router.get("/categories", requireMagicAuth, getBusinessFromUser, async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      where: { businessId: req.business.id },
      include: {
        services: {
          orderBy: { name: 'asc' }
        }
      },
      orderBy: { name: 'asc' }
    });
    
    res.json(categories);
  } catch (error) {
    console.error("Error getting categories:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create category
router.post("/categories", requireMagicAuth, getBusinessFromUser, async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Category name is required" });
    }
    
    const category = await prisma.category.create({
      data: {
        name: name.trim(),
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
router.patch("/categories/:id", requireMagicAuth, getBusinessFromUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
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
        name: name?.trim() || category.name
      }
    });
    
    res.json(updatedCategory);
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete category
router.delete("/categories/:id", requireMagicAuth, getBusinessFromUser, async (req, res) => {
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
router.get("/services", requireMagicAuth, getBusinessFromUser, async (req, res) => {
  try {
    const services = await prisma.service.findMany({
      where: { businessId: req.business.id },
      include: {
        category: true
      },
      orderBy: { name: 'asc' }
    });
    
    res.json(services);
  } catch (error) {
    console.error("Error getting services:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create service
router.post("/services", requireMagicAuth, getBusinessFromUser, async (req, res) => {
  try {
    const { name, duration, price, categoryId } = req.body;
    
    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Service name is required" });
    }
    
    if (!duration || duration <= 0) {
      return res.status(400).json({ error: "Duration must be greater than 0" });
    }
    
    if (!price || price < 0) {
      return res.status(400).json({ error: "Price must be greater than or equal to 0" });
    }
    
    const service = await prisma.service.create({
      data: {
        name: name.trim(),
        duration: parseInt(duration),
        price: parseInt(price),
        categoryId: categoryId ? parseInt(categoryId) : null,
        businessId: req.business.id
      },
      include: {
        category: true
      }
    });
    
    res.json(service);
  } catch (error) {
    console.error("Error creating service:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update service
router.patch("/services/:id", requireMagicAuth, getBusinessFromUser, async (req, res) => {
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
        price: price !== undefined ? parseInt(price) : service.price,
        categoryId: categoryId ? parseInt(categoryId) : service.categoryId
      },
      include: {
        category: true
      }
    });
    
    res.json(updatedService);
  } catch (error) {
    console.error("Error updating service:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete service
router.delete("/services/:id", requireMagicAuth, getBusinessFromUser, async (req, res) => {
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
router.get("/masters", requireMagicAuth, getBusinessFromUser, async (req, res) => {
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
router.post("/masters", requireMagicAuth, getBusinessFromUser, async (req, res) => {
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
router.patch("/masters/:id", requireMagicAuth, getBusinessFromUser, async (req, res) => {
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
        active: active !== undefined ? Boolean(active) : master.active
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
router.delete("/masters/:id", requireMagicAuth, getBusinessFromUser, async (req, res) => {
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

module.exports = router;
