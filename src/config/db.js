import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let memoryServer = null;

/**
 * Connect to MongoDB.
 * - If MONGODB_URI is set, use it (production / real DB).
 * - Otherwise fall back to mongodb-memory-server so `npm run dev`
 *   works with zero setup. Never used in production.
 */
export async function connectDB() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  const uri = process.env.MONGODB_URI;
  if (uri) {
    await mongoose.connect(uri);
    console.log("MongoDB connected");
    return mongoose.connection;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("MONGODB_URI is required in production");
  }
  console.log("MONGODB_URI not set — starting in-memory MongoDB (dev only)...");
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri());
  console.log("In-memory MongoDB connected");
  return mongoose.connection;
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}
