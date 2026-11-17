import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import { seedIfEmpty } from "./utils/seedData.js";
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

// Stripe webhook MUST be mounted before express.json() — it needs the raw body
// for signature verification.
app.post("/api/payments/webhook", express.raw({ type: "application/json" }), handleWebhook);

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
    await connectDB();
    // Dev-only: with no MONGODB_URI the DB is a fresh in-memory instance
    // per process, so `npm run seed` in another process could never be
    // seen here. Auto-seed the empty dev DB so the demo works out of box.
    if (!process.env.MONGODB_URI) await seedIfEmpty();
    app.listen(PORT, () => console.log(`SalonBook server running on port ${PORT}`));
  } catch (err) {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  }
}

start();

export default app;
