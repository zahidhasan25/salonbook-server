import express from "express";
import User from "../models/User.js";
import { authenticate, publicUser, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// GET /api/users — admin; customers only, no passwords
router.get("/", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const users = await User.find({ role: "customer" }).sort({ createdAt: -1 });
    res.json({ users: users.map(publicUser) });
  } catch (err) { next(err); }
});

// PATCH /api/users/:id/block — admin
router.patch("/:id/block", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { isBlocked } = req.body;
    if (typeof isBlocked !== "boolean") return res.status(400).json({ message: "isBlocked must be true or false" });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role === "admin") return res.status(400).json({ message: "Admin accounts cannot be blocked" });
    user.isBlocked = isBlocked;
    await user.save();
    res.json({ user: publicUser(user) });
  } catch (err) { next(err); }
});

export default router;
