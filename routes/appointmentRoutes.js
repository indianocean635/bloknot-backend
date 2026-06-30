const express = require("express");
const {
  getAppointments,
  createAppointment,
  deleteAppointment,
  deletePublicAppointment,
  updateAppointment,
  getPublicAppointments,
  createPublicAppointment,
  getPublicAppointmentByToken,
  createVKLinkCode,
  createVKLinkCodeByToken
} = require("../controllers/appointmentController");
const { getBusinessBySlug } = require("../controllers/businessController");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();

// Protected endpoints
router.get("/appointments", requireAuth, getAppointments);
router.post("/appointments", requireAuth, createAppointment);
router.delete("/appointments/:id", requireAuth, deleteAppointment);
router.put("/appointments/:id", requireAuth, updateAppointment);

// Публичные эндпоинты
router.get("/public/business/:slug", getBusinessBySlug);
router.get("/public/appointments", getPublicAppointments);
router.get("/public/appointment/:token", getPublicAppointmentByToken);
router.post("/public/appointments", createPublicAppointment);
router.delete("/public/appointments/:id", deletePublicAppointment);
router.post("/appointments/:id/vk-request", createVKLinkCode);
router.post("/public/appointment/:token/vk-request", createVKLinkCodeByToken);

module.exports = router;
