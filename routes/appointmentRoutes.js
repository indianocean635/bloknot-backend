const express = require("express");
const { 
  getAppointments, 
  getPublicAppointments, 
  createPublicAppointment, 
  createAppointment, 
  updateAppointment, 
  deleteAppointment, 
  getAppointmentById 
} = require("../controllers/appointmentController");
const { getBusinessBySlug } = require("../controllers/businessController");
const { requireMagicAuth, getBusinessFromUser, getBusinessBySlug: getBusinessBySlugMiddleware } = require("../middleware/magicAuthMiddleware");

const router = express.Router();

// Protected endpoints
router.get("/appointments", requireMagicAuth, getBusinessFromUser, getAppointments);
router.post("/appointments", requireMagicAuth, getBusinessFromUser, createAppointment);
router.delete("/appointments/:id", requireMagicAuth, getBusinessFromUser, deleteAppointment);
router.put("/appointments/:id", requireMagicAuth, getBusinessFromUser, updateAppointment);

// Публичные эндпоинты
router.get("/public/business/:slug", getBusinessBySlug);
router.get("/public/appointments", getPublicAppointments);
router.post("/public/appointments", createPublicAppointment);
// router.get("/public/appointments/:id", getBusinessBySlug, getAppointmentById); // Temporarily disabled

module.exports = router;
