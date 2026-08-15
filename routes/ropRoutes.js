const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const STAFF_ROLES = ['ADMIN_STAFF', 'SALES_STAFF', 'STAFF'];
const ADMIN_ROLES = ['SUPER_ADMIN', ...STAFF_ROLES];

const DATA_FILE = path.join(__dirname, '..', 'rop-data.json');

function isAdmin(role) {
  return role === 'SUPER_ADMIN';
}

function isStaff(role) {
  return ADMIN_ROLES.includes(role);
}

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return [];
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error('[ROP] Load data error:', error);
    return [];
  }
}

function saveData(records) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2), 'utf8');
  } catch (error) {
    console.error('[ROP] Save data error:', error);
    throw error;
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// List all ROP records
router.get('/', requireAuth, async (req, res) => {
  try {
    const { role } = req.user;
    if (!isStaff(role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const records = loadData();
    res.json({ success: true, records });
  } catch (error) {
    console.error('[ROP GET]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a ROP record
router.post('/', requireAuth, async (req, res) => {
  try {
    const { role } = req.user;
    if (!isStaff(role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { fio, requisites, sales, emails, twoWeeks, bonuses, total } = req.body;
    if (!fio || !fio.trim()) {
      return res.status(400).json({ error: 'FIO is required' });
    }

    const records = loadData();
    const record = {
      id: generateId(),
      fio: fio.trim(),
      requisites: requisites ? requisites.trim() : '',
      sales: sales ? String(sales).trim() : '',
      emails: emails ? String(emails).trim() : '',
      twoWeeks: twoWeeks ? String(twoWeeks).trim() : '',
      bonuses: bonuses ? String(bonuses).trim() : '',
      total: total ? String(total).trim() : '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    records.push(record);
    saveData(records);

    res.json({ success: true, record });
  } catch (error) {
    console.error('[ROP POST]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a ROP record
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { role } = req.user;
    if (!isStaff(role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { id } = req.params;
    const records = loadData();
    const index = records.findIndex(r => r.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Record not found' });
    }

    const { fio, requisites, sales, emails, twoWeeks, bonuses, total } = req.body;
    if (fio !== undefined && !fio.trim()) {
      return res.status(400).json({ error: 'FIO is required' });
    }

    records[index] = {
      ...records[index],
      fio: fio ? fio.trim() : records[index].fio,
      requisites: requisites !== undefined ? String(requisites).trim() : records[index].requisites,
      sales: sales !== undefined ? String(sales).trim() : records[index].sales,
      emails: emails !== undefined ? String(emails).trim() : records[index].emails,
      twoWeeks: twoWeeks !== undefined ? String(twoWeeks).trim() : records[index].twoWeeks,
      bonuses: bonuses !== undefined ? String(bonuses).trim() : records[index].bonuses,
      total: total !== undefined ? String(total).trim() : records[index].total,
      updatedAt: new Date().toISOString()
    };

    saveData(records);
    res.json({ success: true, record: records[index] });
  } catch (error) {
    console.error('[ROP PUT]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a ROP record
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { role } = req.user;
    if (!isStaff(role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { id } = req.params;
    const records = loadData();
    const newRecords = records.filter(r => r.id !== id);
    if (newRecords.length === records.length) {
      return res.status(404).json({ error: 'Record not found' });
    }

    saveData(newRecords);
    res.json({ success: true });
  } catch (error) {
    console.error('[ROP DELETE]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset all calculated columns, preserve fio and requisites (super admin only)
router.post('/reset', requireAuth, async (req, res) => {
  try {
    const { role } = req.user;
    if (!isAdmin(role)) {
      return res.status(403).json({ error: 'Forbidden - only SUPER_ADMIN can reset' });
    }

    const records = loadData();
    records.forEach(record => {
      record.sales = '';
      record.emails = '';
      record.twoWeeks = '';
      record.bonuses = '';
      record.total = '';
      record.updatedAt = new Date().toISOString();
    });

    saveData(records);
    res.json({ success: true, records });
  } catch (error) {
    console.error('[ROP RESET]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
