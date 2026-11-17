import express from "express";
import mongoose from "mongoose";
import Appointment, { TIME_SLOTS } from "../models/Appointment.js";
import Service from "../models/Service.js";
import { authenticate, requireAdmin, requireCustomer } from "../middleware/auth.js";
import { getUserById, publicUser } from "../lib/users.js";

const router = express.Router();

function serialize(a) {
  const o = a.toObject ? a.toObject() : a;
  return { ...o, id: o._id?.toString() };
}

// POST /api/appointments — customer only
router.post("/", authenticate, requireCustomer, async (req, res, next) => {
  try {
    const { serviceId, appointmentDate, timeSlot, message } = req.body;
    if (!serviceId || !appointmentDate || !timeSlot) {
      return res.status(400).json({ message: "Service, appointment date and time slot are required" });
    }
    if (!TIME_SLOTS.includes(timeSlot)) return res.status(400).json({ message: "Invalid time slot" });
    if (!mongoose.isValidObjectId(serviceId)) return res.status(404).json({ message: "Service not found" });
    const service = await Service.findById(serviceId);
    if (!service) return res.status(404).json({ message: "Service not found" });
    if (service.status !== "active") return res.status(400).json({ message: "This service is not available for booking" });

    const date = new Date(appointmentDate);
    if (Number.isNaN(date.getTime())) return res.status(400).json({ message: "Invalid appointment date" });
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const day = new Date(date); day.setHours(0, 0, 0, 0);
    if (day < today) return res.status(400).json({ message: "Appointment date must be today or in the future" });

    // Duplicate active appointment: same customer + service + date + slot
    const start = new Date(day); const end = new Date(day); end.setDate(end.getDate() + 1);
    const dup = await Appointment.findOne({
      customerId: req.user.id, serviceId,
      appointmentDate: { $gte: start, $lt: end },
      timeSlot, status: { $in: ["pending", "confirmed"] },
    });
    if (dup) return res.status(409).json({ message: "You already have an active appointment for this service at that date and time" });

    const appt = await Appointment.create({
      serviceId, customerId: req.user.id, appointmentDate: date, timeSlot,
      message: message || "", servicePrice: service.price,
      status: "pending", paymentStatus: "unpaid",
    });
    res.status(201).json({ appointment: serialize(appt) });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ message: "You already have an active appointment for this service at that date and time" });
    next(err);
  }
});

// GET /api/appointments/mine — customer (must be before /:id)
router.get("/mine", authenticate, requireCustomer, async (req, res, next) => {
  try {
    const list = await Appointment.find({ customerId: req.user.id })
      .populate("serviceId").sort({ createdAt: -1 });
    res.json({ appointments: list.map(serialize) });
  } catch (err) { next(err); }
});

// GET /api/appointments — admin, all
router.get("/", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const list = await Appointment.find().populate("serviceId").sort({ createdAt: -1 });
    const out = [];
    for (const appt of list) {
      const s = serialize(appt);
      const u = await getUserById(appt.customerId);
      s.customerId = u ? publicUser(u) : appt.customerId; // same shape as the old populate
      out.push(s);
    }
    res.json({ appointments: out });
  } catch (err) { next(err); }
});

// GET /api/appointments/:id — owner or admin
router.get("/:id", authenticate, async (req, res, next) => {
  try {
    const appt = await Appointment.findById(req.params.id).populate("serviceId");
    if (!appt) return res.status(404).json({ message: "Appointment not found" });
    if (req.user.role !== "admin" && appt.customerId !== req.user.id) {
      return res.status(403).json({ message: "Forbidden: this is not your appointment" });
    }
    const s = serialize(appt);
    if (req.user.role === "admin") {
      const u = await getUserById(appt.customerId);
      s.customerId = u ? publicUser(u) : appt.customerId;
    }
    res.json({ appointment: s });
  } catch (err) { next(err); }
});

// PATCH /api/appointments/:id/status — admin; only pending can be confirmed
router.patch("/:id/status", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!["confirmed", "cancelled"].includes(status)) return res.status(400).json({ message: "Status must be confirmed or cancelled" });
    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ message: "Appointment not found" });
    if (status === "confirmed" && appt.status !== "pending") {
      return res.status(400).json({ message: "Only pending appointments can be confirmed" });
    }
    if (status === "cancelled" && appt.status === "cancelled") {
      return res.status(400).json({ message: "Appointment is already cancelled" });
    }
    appt.status = status;
    await appt.save();
    res.json({ appointment: serialize(appt) });
  } catch (err) { next(err); }
});

// PATCH /api/appointments/:id/cancel — customer, own pending only
router.patch("/:id/cancel", authenticate, requireCustomer, async (req, res, next) => {
  try {
    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ message: "Appointment not found" });
    if (appt.customerId !== req.user.id) {
      return res.status(403).json({ message: "Forbidden: you can only cancel your own appointments" });
    }
    if (appt.status !== "pending") {
      return res.status(400).json({ message: "Only pending appointments can be cancelled" });
    }
    appt.status = "cancelled";
    await appt.save();
    res.json({ appointment: serialize(appt) });
  } catch (err) { next(err); }
});

export default router;
