import { getAuth } from "../lib/auth.js";
import { fromNodeHeaders } from "better-auth/node";
import { publicUser } from "../lib/users.js";

export { publicUser };

/** Resolve the logged-in Better Auth user from the session cookie, or null. */
export async function getSessionUser(req) {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  return session?.user || null;
}

/** Require a valid Better Auth session; reject blocked users (403). */
export async function authenticate(req, res, next) {
  try {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ message: "Unauthorized: please sign in" });
    if (user.isBlocked) return res.status(403).json({ message: "Your account is blocked. Contact the salon." });
    // Plain object (not a Mongoose doc). _id aliases id so existing
    // route code using req.user._id keeps working; id is the Better Auth id.
    req.user = { ...publicUser(user), _id: user.id };
    next();
  } catch (err) {
    next(err);
  }
}

/** Attach req.user when a valid session exists; continue anonymously otherwise. */
export async function optionalAuth(req, res, next) {
  try {
    const user = await getSessionUser(req);
    if (user && !user.isBlocked) req.user = { ...publicUser(user), _id: user.id };
  } catch { /* anonymous */ }
  next();
}

/** Require one of the given roles (server-side role verification). */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: insufficient permissions" });
    }
    next();
  };
}

export const requireAdmin = requireRole("admin");
export const requireCustomer = requireRole("customer");
