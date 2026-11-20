import express from "express";
import Stripe from "stripe";
import Appointment from "../models/Appointment.js";
import Transaction from "../models/Transaction.js";
import { authenticate, requireCustomer } from "../middleware/auth.js";

const router = express.Router();

function stripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

// POST /api/payments/checkout — customer; only own confirmed + unpaid appointment
router.post("/checkout", authenticate, requireCustomer, async (req, res, next) => {
  try {
    const { appointmentId } = req.body;
    if (!appointmentId) return res.status(400).json({ message: "appointmentId is required" });
    const appt = await Appointment.findById(appointmentId).populate("serviceId");
    if (!appt) return res.status(404).json({ message: "Appointment not found" });
    if (appt.customerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Forbidden: this is not your appointment" });
    }
    if (appt.status !== "confirmed") {
      return res.status(400).json({ message: "Only confirmed appointments can be paid for" });
    }
    if (appt.paymentStatus === "paid") {
      return res.status(400).json({ message: "This appointment is already paid" });
    }

    const clientUrl = (process.env.CLIENT_URL || "http://localhost:3000").replace(/\/$/, "");
    const stripe = stripeClient();
    if (stripe) {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: { name: appt.serviceId?.serviceName || "Salon service" },
            unit_amount: Math.round(Number(appt.servicePrice) * 100),
          },
          quantity: 1,
        }],
        metadata: { appointmentId: appt._id.toString(), customerId: req.user._id.toString() },
        success_url: `${clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${clientUrl}/payment/cancel`,
      });
      return res.json({ url: session.url, sessionId: session.id });
    }

    if (process.env.DEMO_PAYMENTS === "true") {
      // Demo mode (no Stripe key): client goes to the success page with a demo session id.
      // The demo success flow must NOT mark paid by itself — see webhook/demo note in README.
      return res.json({ url: `${clientUrl}/payment/success?session_id=demo_${appt._id}&demo=true`, sessionId: `demo_${appt._id}`, demo: true });
    }

    return res.status(503).json({
      message: "Payments are not configured. Set STRIPE_SECRET_KEY, or enable DEMO_PAYMENTS=true for demo checkout.",
    });
  } catch (err) { next(err); }
});

// GET /api/payments/session/:sessionId — customer; real payment status for the success page.
// The success page must never claim Paid from static text: only a webhook-created
// transaction proves the payment. While the webhook has not processed the event
// yet, this returns { status: "pending" } and the client polls until it is paid.
router.get("/session/:sessionId", authenticate, requireCustomer, async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const txn = await Transaction.findOne({ stripeSessionId: sessionId })
      .populate({ path: "appointmentId", populate: { path: "serviceId" } });
    if (txn) {
      const a = txn.appointmentId;
      if (!a || a.customerId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "Forbidden: this is not your payment" });
      }
      return res.json({
        status: "paid",
        amount: txn.amount,
        currency: txn.currency,
        serviceName: a.serviceId?.serviceName || null,
        appointmentDate: a.appointmentDate,
      });
    }
    if (sessionId.startsWith("demo_")) {
      const appt = await Appointment.findById(sessionId.slice(5)).populate("serviceId");
      if (!appt) return res.status(404).json({ message: "Appointment not found" });
      if (appt.customerId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "Forbidden: this is not your payment" });
      }
      return res.json({
        status: appt.paymentStatus === "paid" ? "paid" : "pending",
        amount: appt.servicePrice,
        currency: "usd",
        serviceName: appt.serviceId?.serviceName || null,
        appointmentDate: appt.appointmentDate,
        demo: true,
      });
    }
    // Stripe accepted the payment but the webhook has not processed it yet.
    return res.json({ status: "pending" });
  } catch (err) { next(err); }
});

// Webhook handler — exported so index.js can mount it BEFORE express.json()
// (Stripe signature verification needs the raw body). Never mark an appointment
// paid without a verified webhook event in production.
export async function handleWebhook(req, res) {
  const stripe = stripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  if (stripe && webhookSecret) {
    const sig = req.headers["stripe-signature"];
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  } else if (stripe && !webhookSecret) {
    // Stripe is configured but no webhook secret — refuse to trust unverified events.
    return res.status(400).send("Webhook secret is not configured");
  } else {
    // No Stripe at all: accept only demo events in demo mode, and only for demo_* sessions.
    if (process.env.DEMO_PAYMENTS !== "true") {
      return res.status(503).send("Payments are not configured");
    }
    try { event = JSON.parse(req.body.toString()); }
    catch { return res.status(400).send("Invalid JSON body"); }
    if (event?.type !== "checkout.session.completed" || !String(event?.data?.object?.id || "").startsWith("demo_")) {
      return res.status(400).send("Demo webhook only accepts demo checkout.session.completed events");
    }
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const appointmentId = session.metadata?.appointmentId;
    const sessionId = session.id;
    try {
      const existing = await Transaction.findOne({ stripeSessionId: sessionId });
      if (existing) return res.json({ received: true, duplicate: true });
      const appt = appointmentId ? await Appointment.findById(appointmentId) : null;
      if (!appt) return res.status(404).json({ message: "Appointment not found for webhook" });
      appt.paymentStatus = "paid";
      await appt.save();
      await Transaction.create({
        appointmentId: appt._id,
        customerId: appt.customerId,
        amount: session.amount_total ? session.amount_total / 100 : appt.servicePrice,
        currency: session.currency || "usd",
        stripeSessionId: sessionId,
        status: "paid",
      });
    } catch (err) {
      console.error("Webhook handling failed:", err);
      return res.status(500).json({ message: "Webhook handling failed" });
    }
  }

  res.json({ received: true });
}

export default router;
