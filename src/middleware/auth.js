import jwt from "jsonwebtoken";
import User from "../models/User.js";

function jwtSecret() {
  return process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET || "";
}

export function signToken(user) {
  const secret = jwtSecret();
  if (!secret) throw new Error("BETTER_AUTH_SECRET / JWT_SECRET is not set");
  return jwt.sign({ id: user._id.toString(), role: user.role }, secret, { expiresIn: "7d" });
}

export function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    image: user.image || "",
    phone: user.phone || "",
    role: user.role,
    isBlocked: user.isBlocked,
    createdAt: user.createdAt,
  };
}

/** Verify JWT from `Authorization: Bearer <token>`, attach req.user, reject blocked users. */
export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Unauthorized: token required" });
    const secret = jwtSecret();
    if (!secret) return res.status(500).json({ message: "Server auth is not configured" });
    const decoded = jwt.verify(token, secret);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: "Unauthorized: user not found" });
    if (user.isBlocked) return res.status(403).json({ message: "Your account is blocked. Contact the salon." });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized: invalid or expired token" });
  }
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
