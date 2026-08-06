const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const { prisma } = require('../services/prismaService');

const router = express.Router();

const STAFF_ROLES = ['ADMIN_STAFF', 'SALES_STAFF', 'STAFF'];
const ADMIN_ROLES = ['SUPER_ADMIN', ...STAFF_ROLES];

function isAdmin(role) {
  return role === 'SUPER_ADMIN';
}

function isStaff(role) {
  return ADMIN_ROLES.includes(role);
}

// List CRM records
// Query params: staffId (super admin only)
router.get('/', requireAuth, async (req, res) => {
  try {
    const { role, id } = req.user;
    if (!isStaff(role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    let staffId = id;
    if (req.query.staffId) {
      if (!isAdmin(role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      staffId = req.query.staffId;

      const staffExists = await prisma.user.count({
        where: { id: staffId, role: 'SALES_STAFF' }
      });
      if (!staffExists) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const records = await prisma.crmRecord.findMany({
      where: { staffId },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, records });
  } catch (error) {
    console.error('[CRM GET]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a CRM record
router.post('/', requireAuth, async (req, res) => {
  try {
    const { role, id } = req.user;
    if (!isStaff(role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { name, phone, salon, tariff, date, registered, comment, staffId } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    let targetStaffId = id;
    if (staffId) {
      if (!isAdmin(role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const staffExists = await prisma.user.count({
        where: { id: staffId, role: 'SALES_STAFF' }
      });
      if (!staffExists) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      targetStaffId = staffId;
    }

    const record = await prisma.crmRecord.create({
      data: {
        staffId: targetStaffId,
        name: name.trim(),
        phone: phone ? phone.trim() : null,
        salon: salon ? salon.trim() : null,
        tariff: tariff ? tariff.trim() : null,
        date: date ? new Date(date) : null,
        registered: registered === true || registered === 'true' || registered === '1',
        comment: comment ? comment.trim() : null
      }
    });

    res.json({ success: true, record });
  } catch (error) {
    console.error('[CRM POST]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a CRM record
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    if (!isStaff(role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { id } = req.params;
    const existing = await prisma.crmRecord.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Record not found' });
    }

    if (!isAdmin(role) && existing.staffId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { name, phone, salon, tariff, date, registered, comment } = req.body;

    const record = await prisma.crmRecord.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : existing.name,
        phone: phone !== undefined ? (phone ? phone.trim() : null) : existing.phone,
        salon: salon !== undefined ? (salon ? salon.trim() : null) : existing.salon,
        tariff: tariff !== undefined ? (tariff ? tariff.trim() : null) : existing.tariff,
        date: date !== undefined ? (date ? new Date(date) : null) : existing.date,
        registered: registered !== undefined ? (registered === true || registered === 'true' || registered === '1') : existing.registered,
        comment: comment !== undefined ? (comment ? comment.trim() : null) : existing.comment
      }
    });

    res.json({ success: true, record });
  } catch (error) {
    console.error('[CRM PUT]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a CRM record
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    if (!isStaff(role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { id } = req.params;
    const existing = await prisma.crmRecord.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Record not found' });
    }

    if (!isAdmin(role) && existing.staffId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.crmRecord.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('[CRM DELETE]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List staff for super admin selector
router.get('/staff', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const staff = await prisma.user.findMany({
      where: { role: 'SALES_STAFF' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true, role: true }
    });

    res.json({ success: true, staff });
  } catch (error) {
    console.error('[CRM STAFF]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
