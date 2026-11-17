import express from "express";
import { listCustomers, publicUser, setUserBlocked, getUserById } from "../lib/users.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// GET /api/users — admin; customers only, no passwords
router.get("/", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const users = await listCustomers();
    res.json({ users: users.map(publicUser) });
  } catch (err) { next(err); }
});

// PATCH /api/users/:id/block — admin
router.patch("/:id/block", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { isBlocked } = req.body;
    if (typeof isBlocked !== "boolean") return res.status(400).json({ message: "isBlocked must be true or false" });
    const user = await getUserById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role === "admin") return res.status(400).json({ message: "Admin accounts cannot be blocked" });
    const updated = await setUserBlocked(req.params.id, isBlocked);
    res.json({ user: publicUser(updated) });
  } catch (err) { next(err); }
});

export default router;
