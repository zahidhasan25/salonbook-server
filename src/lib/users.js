import { ObjectId } from "mongodb";
import { getDb } from "../config/db.js";

// The `user` collection stores _id as a BSON ObjectId, while Better Auth's
// API exposes it as a 24-char hex string (user.id). Convert for raw queries.
function toObjectId(id) {
  if (!id) return id;
  try { return new ObjectId(id); } catch { return id; }
}

/**
 * Users live in Better Auth's `user` collection (not a Mongoose model —
 * Better Auth owns that collection via the mongodb adapter). These helpers
 * are the only way the rest of the server reads/writes users.
 */

export function publicUser(doc) {
  if (!doc) return null;
  // Raw docs from the `user` collection store the id in `_id` (a string);
  // Better Auth's API maps it to `id` on read. Accept both shapes.
  const id = doc.id || (doc._id ? doc._id.toString() : undefined);
  return {
    id,
    _id: id, // alias: old code used req.user._id / user._id
    name: doc.name,
    email: doc.email,
    image: doc.image || "",
    phone: doc.phone || "",
    role: doc.role || "customer",
    isBlocked: !!doc.isBlocked,
    createdAt: doc.createdAt,
  };
}

export async function getUserById(id) {
  return getDb().collection("user").findOne({ _id: toObjectId(id) });
}

export async function getUserByEmail(email) {
  return getDb().collection("user").findOne({ email: email.toLowerCase() });
}

export async function listCustomers() {
  return getDb().collection("user").find({ role: "customer" }).sort({ createdAt: -1 }).toArray();
}

export async function setUserBlocked(id, isBlocked) {
  await getDb().collection("user").updateOne({ _id: toObjectId(id) }, { $set: { isBlocked } });
  return getUserById(id);
}

export async function updateUserProfile(id, fields) {
  await getDb().collection("user").updateOne({ _id: toObjectId(id) }, { $set: fields });
  return getUserById(id);
}
