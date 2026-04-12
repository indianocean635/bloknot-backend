const express = require("express");
const { 
  getAppointments, 
  getPublicAppointments, 
  createAppointment, 
  deleteAppointment, 
  getAppointmentById 
} = require("../controllers/appointmentController");
const { requireMagicAuth, getBusinessFromUser, getBusinessBySlug } = require("../middleware/magicAuthMiddleware");

const router = express.Router();

// Protected endpoints
router.get("/appointments", requireMagicAuth, getBusinessFromUser, getAppointments);
router.delete("/appointments/:id", requireMagicAuth, getBusinessFromUser, deleteAppointment);

// Публичные эндпоинты
router.get("/public/appointments", getBusinessBySlug, getPublicAppointments);
router.post("/public/appointments", getBusinessBySlug, createAppointment);
router.get("/public/appointments/:id", getBusinessBySlug, getAppointmentById);

module.exports = router;
