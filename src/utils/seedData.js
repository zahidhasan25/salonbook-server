import { getAuth } from "../lib/auth.js";
import { getDb } from "../config/db.js";
import { getUserByEmail } from "../lib/users.js";
import Service from "../models/Service.js";

export const SERVICES = [
  { serviceName: "Classic Haircut", category: "Haircut & Styling", description: "Precision cut, wash and blow-dry tailored to your face shape.", price: 25, duration: 45, image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80" },
  { serviceName: "Balayage Hair Coloring", category: "Hair Coloring", description: "Hand-painted balayage highlights for a natural sun-kissed look.", price: 85, duration: 120, image: "https://images.unsplash.com/photo-1562322140-8baeececf3df?w=800&q=80" },
  { serviceName: "Keratin Hair Treatment", category: "Hair Treatment", description: "Smoothing keratin treatment that tames frizz for weeks.", price: 120, duration: 150, image: "https://images.unsplash.com/photo-1522337660859-02fbefca4702?w=800&q=80" },
  { serviceName: "Signature Facial", category: "Facial & Skincare", description: "Deep-cleansing facial with mask and relaxing massage.", price: 60, duration: 60, image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&q=80" },
  { serviceName: "Bridal Makeup", category: "Makeup", description: "Full bridal glam with long-lasting HD makeup and lashes.", price: 150, duration: 90, image: "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=800&q=80" },
  { serviceName: "Luxury Manicure & Pedicure", category: "Manicure & Pedicure", description: "Soak, scrub, shaping and polish for hands and feet.", price: 45, duration: 75, image: "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800&q=80" },
  { serviceName: "Hot Stone Spa Massage", category: "Spa & Massage", description: "Warm-stone full-body massage to melt away tension.", price: 90, duration: 90, image: "https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=800&q=80" },
  { serviceName: "Blowout & Styling", category: "Haircut & Styling", description: "Voluminous salon blowout with heat styling and shine finish.", price: 35, duration: 40, image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80" },
];

async function seedUser(email, name, password, role) {
  const existing = await getUserByEmail(email);
  if (existing) {
    // Idempotent re-run: still make sure the admin really is an admin.
    if (role === "admin" && existing.role !== "admin") {
      await getDb().collection("user").updateOne({ email }, { $set: { role: "admin" } });
      console.log(`Promoted to admin: ${email}`);
    } else {
      console.log(`User exists, skipping: ${email}`);
    }
    return existing;
  }
  // Create through Better Auth so the password is hashed and the account
  // row is created exactly as a real sign-up would create it.
  const auth = await getAuth();
  await auth.api.signUpEmail({ body: { name, email, password } });
  console.log(`Created ${role}: ${email}`);
  if (role === "admin") {
    // Role is input:false in Better Auth, so it can never come from a
    // sign-up request — set it directly on the `user` collection.
    await getDb().collection("user").updateOne({ email }, { $set: { role: "admin" } });
  }
  return getUserByEmail(email);
}

// Idempotent: only seeds when the DB is empty, so a real DB is never
// overwritten. Used by `npm run seed` (real MongoDB only).
export async function seedIfEmpty() {
  const userCount = await getDb().collection("user").countDocuments();
  const serviceCount = await Service.countDocuments();
  if (userCount > 0 && serviceCount > 0) { console.log("Seed: data already present, skipping."); return; }
  await seedUser("admin@salonbook.com", "Salon Admin", "Admin123", "admin");
  await seedUser("demo@salonbook.com", "Demo Customer", "Customer123", "customer");
  for (const s of SERVICES) {
    if (!(await Service.findOne({ serviceName: s.serviceName }))) {
      await Service.create({ ...s, status: "active" });
    }
  }
  console.log("Seed complete: admin + demo customer + 8 services.");
}
