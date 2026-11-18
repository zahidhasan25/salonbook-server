import "dotenv/config";
import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { connectDB } from "./config/db.js";
import { getAuth } from "./lib/auth.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import authRoutes from "./routes/auth.js";
import serviceRoutes from "./routes/services.js";
import appointmentRoutes from "./routes/appointments.js";
import userRoutes from "./routes/users.js";
import transactionRoutes from "./routes/transactions.js";
import paymentsRouter, { handleWebhook } from "./routes/payments.js";

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

app.use(cors({ origin: [CLIENT_URL, "http://localhost:3000"], credentials: true }));

// Lazy-connect for serverless hosts (Vercel): on a normal server start()
// already connected, so this returns instantly (readyState === 1). On
// Vercel there is no long-lived process, so the first request per cold
// start connects here instead. Never throws for a missing DB on its own —
// connectDB() throws the clear MONGODB_URI error, handled by errorHandler.
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

// Stripe webhook MUST be mounted before express.json() — it needs the raw body
// for signature verification.
app.post("/api/payments/webhook", express.raw({ type: "application/json" }), handleWebhook);

// Better Auth MUST also run before express.json() — toNodeHandler reads the
// raw request body itself. The custom /me and /profile endpoints are NOT
// Better Auth endpoints, so they fall through to the JSON parser + router.
app.all("/api/auth/*", async (req, res, next) => {
  const sub = req.path.replace(/^\/api\/auth/, "");
  if (sub === "/me" || sub === "/profile") return next();
  const auth = await getAuth();
  return toNodeHandler(auth)(req, res);
});

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.get("/", (req, res) => res.json({ message: "SalonBook server is running", health: "/api/health" }));

app.use("/api/auth", authRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/users", userRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/payments", paymentsRouter);

app.use(notFound);
app.use(errorHandler);

async function start() {
  try {
    await connectDB(); // REAL MongoDB — throws a clear error if MONGODB_URI is unset
    await getAuth(); // initialise Better Auth now so a bad config fails fast at boot
    app.listen(PORT, () => console.log(`SalonBook server running on port ${PORT}`));
  } catch (err) {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  }
}

// On Vercel (serverless) there is no long-lived process to listen on —
// Vercel invokes the exported app per request (see api/index.js), and the
// lazy-connect middleware above connects MongoDB on first request. Locally
// (and on any normal host) start the listener as usual.
if (!process.env.VERCEL) {
  start();
}

export default app;
