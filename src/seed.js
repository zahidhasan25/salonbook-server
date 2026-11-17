import "dotenv/config";
import { connectDB, disconnectDB } from "./config/db.js";
import { getAuth } from "./lib/auth.js";
import { seedIfEmpty } from "./utils/seedData.js";

async function main() {
  await connectDB(); // REAL MongoDB — throws if MONGODB_URI is unset
  await getAuth(); // initialise Better Auth (needs the DB connection)
  await seedIfEmpty();
  await disconnectDB();
  process.exit(0);
}
main().catch(async (err) => { console.error("Seed failed:", err); await disconnectDB(); process.exit(1); });
