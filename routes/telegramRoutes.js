const express = require('express');
const router = express.Router();
const { linkBooking, cancelBooking, generateRescheduleLink, sendReminders } = require('../controllers/telegramController');

// POST /api/telegram/link-booking - Link Telegram chatId to booking (called by bot)
router.post('/link-booking', linkBooking);

// POST /api/telegram/cancel-booking - Cancel booking (called by bot)
router.post('/cancel-booking', cancelBooking);

// POST /api/telegram/reschedule-link - Generate reschedule link (called by bot)
router.post('/reschedule-link', generateRescheduleLink);

// POST /api/telegram/send-reminders - Send reminders for upcoming bookings (called by bot)
router.post('/send-reminders', sendReminders);

module.exports = router;
