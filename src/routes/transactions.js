import express from "express";
import Transaction from "../models/Transaction.js";
import { authenticate, requireAdmin, requireCustomer } from "../middleware/auth.js";
import { getUserById, publicUser } from "../lib/users.js";

const router = express.Router();

// GET /api/transactions/mine — customer (before / route is fine; distinct path)
router.get("/mine", authenticate, requireCustomer, async (req, res, next) => {
  try {
    const txns = await Transaction.find({ customerId: req.user.id })
      .populate({ path: "appointmentId", populate: { path: "serviceId" } }).sort({ createdAt: -1 });
    res.json({ transactions: txns });
  } catch (err) { next(err); }
});

// GET /api/transactions — admin, all
router.get("/", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const txns = await Transaction.find()
      .populate({ path: "appointmentId", populate: { path: "serviceId" } }).sort({ createdAt: -1 });
    const out = txns.map((x) => {
      const o = x.toObject ? x.toObject() : x;
      return o;
    });
    for (const o of out) {
      const u = await getUserById(o.customerId);
      o.customerId = u ? { id: u.id, name: u.name, email: u.email } : o.customerId;
    }
    res.json({ transactions: out });
  } catch (err) { next(err); }
});

export default router;
