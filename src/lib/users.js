import { getDb } from "../config/db.js";

/**
 * Users live in Better Auth's `user` collection (not a Mongoose model —
 * Better Auth owns that collection via the mongodb adapter). These helpers
 * are the only way the rest of the server reads/writes users.
 */

export function publicUser(doc) {
  if (!doc) return null;
  return {
    id: doc.id,
    _id: doc.id, // alias: old code used req.user._id / user._id
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
  return getDb().collection("user").findOne({ id });
}

export async function getUserByEmail(email) {
  return getDb().collection("user").findOne({ email: email.toLowerCase() });
}

export async function listCustomers() {
  return getDb().collection("user").find({ role: "customer" }).sort({ createdAt: -1 }).toArray();
}

export async function setUserBlocked(id, isBlocked) {
  await getDb().collection("user").updateOne({ id }, { $set: { isBlocked } });
  return getUserById(id);
}

export async function updateUserProfile(id, fields) {
  await getDb().collection("user").updateOne({ id }, { $set: fields });
  return getUserById(id);
}
