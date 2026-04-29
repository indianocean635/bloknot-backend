const express = require('express');
const controller = require('../controllers/magicLinkController');

console.log('[DEBUG] magicLinkController loaded:', controller);
console.log('[DEBUG] requestLogin type:', typeof controller.requestLogin);
console.log('[DEBUG] confirmLogin type:', typeof controller.confirmLogin);
console.log('[DEBUG] setPassword type:', typeof controller.setPassword);
console.log('[DEBUG] loginWithPassword type:', typeof controller.loginWithPassword);

const { requestLogin, confirmLogin, setPassword, loginWithPassword } = controller;

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
