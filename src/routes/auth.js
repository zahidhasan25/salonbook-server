import express from "express";
import { fromNodeHeaders } from "better-auth/node";
import { authenticate, publicUser } from "../middleware/auth.js";
import { getAuth } from "../lib/auth.js";
import { getUserById, updateUserProfile } from "../lib/users.js";

// NOTE: email sign-up / sign-in / sign-out / Google OAuth / get-session are
// handled by Better Auth itself (mounted in src/index.js):
//   POST /api/auth/sign-up/email   { name, email, password }
//   POST /api/auth/sign-in/email   { email, password }
//   POST /api/auth/sign-in/social  { provider: "google" }
//   POST /api/auth/sign-out
//   GET  /api/auth/get-session
// This router only adds the two custom endpoints below.

const router = express.Router();

// GET /api/auth/me
router.get("/me", authenticate, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// PATCH /api/auth/profile — name, image, phone only. Never role / isBlocked,
// and only the logged-in user's own profile.
router.patch("/profile", authenticate, async (req, res, next) => {
  try {
    const allowed = {};
    if (typeof req.body.name === "string" && req.body.name.trim()) allowed.name = req.body.name.trim();
    if (typeof req.body.image === "string") allowed.image = req.body.image;
    if (typeof req.body.phone === "string") allowed.phone = req.body.phone;
    // Prefer Better Auth's own updateUser so additional fields stay in sync;
    // fall back to a direct update on the `user` collection if it rejects.
    try {
      const auth = await getAuth();
      await auth.api.updateUser({ headers: fromNodeHeaders(req.headers), body: allowed });
    } catch {
      await updateUserProfile(req.user.id, allowed);
    }
    const fresh = await getUserById(req.user.id);
    res.json({ user: publicUser(fresh) });
  } catch (err) { next(err); }
});

export default router;
