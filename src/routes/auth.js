import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { authenticate, publicUser, signToken } from "../middleware/auth.js";

const router = express.Router();

function validatePassword(password) {
  if (!password || password.length < 6) return "Password must be at least 6 characters";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter";
  if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter";
  return null;
}

// POST /api/auth/register — public. Role always defaults to customer; admin can NEVER be created here.
router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password, image } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }
    const pwError = validatePassword(password);
    if (pwError) return res.status(400).json({ message: pwError });
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ message: "An account with this email already exists" });
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email: email.toLowerCase(), password: hashed, image: image || "", role: "customer" });
    res.status(201).json({ user: publicUser(user), token: signToken(user) });
  } catch (err) { next(err); }
});

// POST /api/auth/login
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password are required" });
    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    if (!user) return res.status(401).json({ message: "Invalid email or password" });
    if (user.isBlocked) return res.status(403).json({ message: "Your account is blocked. Contact the salon." });
    if (!user.password) return res.status(401).json({ message: "This account uses Google sign-in. Please sign in with Google." });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: "Invalid email or password" });
    res.json({ user: publicUser(user), token: signToken(user) });
  } catch (err) { next(err); }
});

// POST /api/auth/google — Google OAuth placeholder.
// Full Google OAuth requires GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET and a
// verified ID token; until configured, the client sends the verified profile
// (email/name/image) and we find-or-create a customer account.
router.post("/google", async (req, res, next) => {
  try {
    const { email, name, image } = req.body;
    if (!email || !name) return res.status(400).json({ message: "Google profile (email and name) is required" });
    let user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      if (user.isBlocked) return res.status(403).json({ message: "Your account is blocked. Contact the salon." });
    } else {
      user = await User.create({ name, email: email.toLowerCase(), image: image || "", role: "customer" });
    }
    res.json({ user: publicUser(user), token: signToken(user), googleOAuth: process.env.GOOGLE_CLIENT_ID ? "configured" : "placeholder" });
  } catch (err) { next(err); }
});

// GET /api/auth/me
router.get("/me", authenticate, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// PATCH /api/auth/profile — name, image, phone only. Never role / isBlocked.
router.patch("/profile", authenticate, async (req, res, next) => {
  try {
    const allowed = {};
    if (typeof req.body.name === "string" && req.body.name.trim()) allowed.name = req.body.name.trim();
    if (typeof req.body.image === "string") allowed.image = req.body.image;
    if (typeof req.body.phone === "string") allowed.phone = req.body.phone;
    const user = await User.findByIdAndUpdate(req.user._id, allowed, { new: true, runValidators: true });
    res.json({ user: publicUser(user) });
  } catch (err) { next(err); }
});

export default router;
