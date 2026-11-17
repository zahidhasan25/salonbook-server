import express from "express";
import Transaction from "../models/Transaction.js";
import { authenticate, requireAdmin, requireCustomer } from "../middleware/auth.js";

const router = express.Router();

// GET /api/transactions/mine — customer (before / route is fine; distinct path)
router.get("/mine", authenticate, requireCustomer, async (req, res, next) => {
  try {
    const txns = await Transaction.find({ customerId: req.user._id })
      .populate("appointmentId").sort({ createdAt: -1 });
    res.json({ transactions: txns });
  } catch (err) { next(err); }
});

// GET /api/transactions — admin, all
router.get("/", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const txns = await Transaction.find()
      .populate("appointmentId").populate("customerId", "name email").sort({ createdAt: -1 });
    res.json({ transactions: txns });
  } catch (err) { next(err); }
});

export default router;
