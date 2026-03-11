const express = require("express");
const { 
  getAppointments, 
  getPublicAppointments, 
  createAppointment, 
  deleteAppointment, 
  getAppointmentById 
} = require("../controllers/appointmentController");
const { requireAuth, getBusinessBySlug } = require("../middleware/authMiddleware");

const router = express.Router();

// Защищенные эндпоинты
router.get("/appointments", requireAuth, getAppointments);
router.delete("/appointments/:id", requireAuth, deleteAppointment);

// Публичные эндпоинты
router.get("/public/appointments", getBusinessBySlug, getPublicAppointments);
router.post("/public/appointments", getBusinessBySlug, createAppointment);
router.get("/public/appointments/:id", getBusinessBySlug, getAppointmentById);

module.exports = router;
