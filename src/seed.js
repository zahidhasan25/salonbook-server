import "dotenv/config";
import { connectDB, disconnectDB } from "./config/db.js";
import { seedIfEmpty } from "./utils/seedData.js";

async function main() {
  await connectDB();
  await seedIfEmpty();
  await disconnectDB();
  process.exit(0);
}
main().catch(async (err) => { console.error("Seed failed:", err); await disconnectDB(); process.exit(1); });
