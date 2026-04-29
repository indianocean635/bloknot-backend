const express = require('express');
const { requestLogin, confirmLogin, setPassword, loginWithPassword } = require('../controllers/magicLinkController');

const router = express.Router();

// Request magic link
router.post('/request-login', requestLogin);

// Confirm magic link
router.get('/confirm', confirmLogin);

// Set password
router.post('/set-password', setPassword);

// Login with password
router.post('/login', loginWithPassword);

module.exports = router;
