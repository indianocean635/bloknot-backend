const express = require('express');
const router = express.Router();

// Mock data for users (replace with real database later)
let users = [
  {
    id: '1',
    email: 'peskov142@mail.ru',
    createdAt: new Date('2024-04-07T10:00:00Z'),
    isPaying: false,
    totalPaid: 0,
    nextBillingAt: null
  }
];

// Get admin stats
router.get('/stats', (req, res) => {
  const stats = {
    totalUsers: users.length,
    payingUsers: users.filter(u => u.isPaying).length,
    totalPaid: users.reduce((sum, u) => sum + u.totalPaid, 0)
  };
  res.json(stats);
});

// Get all users
router.get('/users', (req, res) => {
  res.json(users);
});

// Update user
router.patch('/users/:id', (req, res) => {
  const { id } = req.params;
  const { isPaying, totalPaid, nextBillingAt } = req.body;
  
  const userIndex = users.findIndex(u => u.id === id);
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const user = users[userIndex];
  if (isPaying !== undefined) user.isPaying = isPaying;
  if (totalPaid !== undefined) user.totalPaid = Number(totalPaid);
  if (nextBillingAt !== undefined) user.nextBillingAt = nextBillingAt;
  
  users[userIndex] = user;
  res.json(user);
});

// Delete user
router.delete('/users/:id', (req, res) => {
  const { id } = req.params;
  const userIndex = users.findIndex(u => u.id === id);
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  users.splice(userIndex, 1);
  res.json({ success: true });
});

// Impersonate user
router.get('/impersonate/:id', (req, res) => {
  const { id } = req.params;
  const user = users.find(u => u.id === id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  // Set impersonation session
  res.cookie('impersonate', user.email, { maxAge: 3600000 }); // 1 hour
  res.redirect('/dashboard.html?logged=1');
});

// Return from impersonation
router.get('/return', (req, res) => {
  res.clearCookie('impersonate');
  res.redirect('/admin.html');
});

module.exports = router;
