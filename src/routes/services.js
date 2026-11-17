import express from "express";
import multer from "multer";
import mongoose from "mongoose";
import Service from "../models/Service.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { uploadImage } from "../utils/imgbb.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/services — public, only active unless ?status=all (admin only)
router.get("/", async (req, res, next) => {
  try {
    const { search, category, sort, status } = req.query;
    const filter = {};
    if (status === "all") {
      // Admin-only view of inactive services: requires a valid admin token.
      const header = req.headers.authorization || "";
      if (!header.startsWith("Bearer ")) return res.status(401).json({ message: "Admin token required to list all services" });
      // Role is verified by the admin check in the caller path below via token decode;
      // simplest safe check: require admin by loading the user here.
      const jwt = (await import("jsonwebtoken")).default;
      const secret = process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET || "";
      let decoded;
      try { decoded = jwt.verify(header.slice(7), secret); } catch { return res.status(401).json({ message: "Invalid token" }); }
      const User = (await import("../models/User.js")).default;
      const admin = await User.findById(decoded.id);
      if (!admin || admin.role !== "admin") return res.status(403).json({ message: "Admin only" });
    } else {
      filter.status = "active";
    }
    if (search) filter.serviceName = { $regex: search, $options: "i" };
    if (category) filter.category = category;
    let query = Service.find(filter);
    if (sort === "price_asc") query = query.sort({ price: 1 });
    else if (sort === "price_desc") query = query.sort({ price: -1 });
    else query = query.sort({ createdAt: -1 });
    const services = await query;
    res.json({ services });
  } catch (err) { next(err); }
});

// GET /api/services/:id — public
router.get("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Service not found" });
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ message: "Service not found" });
    res.json({ service });
  } catch (err) { next(err); }
});

function validateServiceBody(body) {
  const { serviceName, category, description, price, duration } = body;
  if (!serviceName || !category || !description) return "Service name, category and description are required";
  if (price === undefined || Number(price) <= 0) return "Price must be a positive number";
  if (duration === undefined || Number(duration) <= 0) return "Duration must be a positive number";
  return null;
}

// POST /api/services — admin, multipart image file OR imageUrl
router.post("/", authenticate, requireAdmin, upload.single("image"), async (req, res, next) => {
  try {
    const errMsg = validateServiceBody(req.body);
    if (errMsg) return res.status(400).json({ message: errMsg });
    const image = await uploadImage(req.file, req.body.imageUrl || req.body.image);
    const service = await Service.create({
      serviceName: req.body.serviceName,
      category: req.body.category,
      description: req.body.description,
      price: Number(req.body.price),
      duration: Number(req.body.duration),
      image,
      status: req.body.status === "inactive" ? "inactive" : "active",
    });
    res.status(201).json({ service });
  } catch (err) { next(err); }
});

// PUT /api/services/:id — admin
router.put("/:id", authenticate, requireAdmin, upload.single("image"), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Service not found" });
    const errMsg = validateServiceBody(req.body);
    if (errMsg) return res.status(400).json({ message: errMsg });
    const update = {
      serviceName: req.body.serviceName,
      category: req.body.category,
      description: req.body.description,
      price: Number(req.body.price),
      duration: Number(req.body.duration),
    };
    if (req.body.status) update.status = req.body.status;
    if (req.file || req.body.imageUrl || req.body.image) {
      update.image = await uploadImage(req.file, req.body.imageUrl || req.body.image);
    }
    const service = await Service.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!service) return res.status(404).json({ message: "Service not found" });
    res.json({ service });
  } catch (err) { next(err); }
});

// PATCH /api/services/:id/status — admin
router.patch("/:id/status", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!["active", "inactive"].includes(status)) return res.status(400).json({ message: "Status must be active or inactive" });
    const service = await Service.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!service) return res.status(404).json({ message: "Service not found" });
    res.json({ service });
  } catch (err) { next(err); }
});

// DELETE /api/services/:id — admin
router.delete("/:id", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const service = await Service.findByIdAndDelete(req.params.id);
    if (!service) return res.status(404).json({ message: "Service not found" });
    res.json({ message: "Service deleted" });
  } catch (err) { next(err); }
});

export default router;
