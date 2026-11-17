import mongoose from "mongoose";

/**
 * Connect to REAL MongoDB. MONGODB_URI is REQUIRED — in dev and in
 * production. There is no in-memory / demo database anymore: data must
 * persist across restarts.
 *
 * Local dev:  MONGODB_URI=mongodb://127.0.0.1:27017/salonbook
 * Atlas:      MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/salonbook
 *             (see ATLAS_SETUP.md for the free M0 cluster steps)
 */
export async function connectDB() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Set it in server/.env — " +
      "local: mongodb://127.0.0.1:27017/salonbook, " +
      "Atlas: see ATLAS_SETUP.md for the free cluster setup."
    );
  }
  await mongoose.connect(uri);
  console.log(`MongoDB connected (${mongoose.connection.host}:${mongoose.connection.port}/${mongoose.connection.name})`);
  return mongoose.connection;
}

/** Raw MongoDB driver Db instance (used by the Better Auth adapter). */
export function getDb() {
  const db = mongoose.connection.db;
  if (!db) throw new Error("MongoDB is not connected yet — call connectDB() first");
  return db;
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
