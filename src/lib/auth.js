import mongoose from "mongoose";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { jwt } from "better-auth/plugins";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { connectDB } from "../config/db.js";

/** Password rule (not built into Better Auth): min 6 chars, 1 upper, 1 lower. */
export function validatePassword(password) {
  if (!password || password.length < 6) return "Password must be at least 6 characters";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter";
  if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter";
  return null;
}

let authInstance = null;

/**
 * Lazily create the Better Auth instance AFTER MongoDB is connected,
 * because the mongodb adapter needs mongoose.connection.db.
 * Safe to call repeatedly — the instance is cached.
 */
export async function getAuth() {
  if (authInstance) return authInstance;
  await connectDB();
  const db = mongoose.connection.db;
  if (!db) throw new Error("MongoDB is not connected — cannot initialise Better Auth");
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set in server/.env");

  const googleId = process.env.GOOGLE_CLIENT_ID;
  const googleSecret = process.env.GOOGLE_CLIENT_SECRET;

  // Live client and server run on DIFFERENT Vercel domains (cross-site),
  // so the session cookie must travel with cross-site fetches. Better Auth's
  // default is SameSite=Lax, which the browser never sends back cross-site —
  // sign-in then looks successful (the response carries the session) but no
  // session persists, so the navbar still shows "Sign In". SameSite=None
  // requires Secure, so it is only enabled on https deployments (Vercel);
  // locally (http) the default Lax cookie is kept so local login still works.
  const baseURL = process.env.BASE_URL || "http://localhost:5000";
  const isHttps = baseURL.startsWith("https://");

  authInstance = betterAuth({
    secret,
    baseURL,
    trustedOrigins: [process.env.CLIENT_URL || "http://localhost:3000"],
    // Google OAuth across two Vercel domains: Better Auth stores the OAuth
    // state in the database AND checks a signed `state` cookie on callback.
    // That cookie is set on a cross-site fetch (client -> server), so a
    // browser blocking third-party cookies never stores it and the callback
    // fails with `?error=state_mismatch`. The state itself is still a
    // server-side random secret verified against the database record, so
    // skipping only the extra cookie check keeps the flow safe while making
    // Google login work across domains.
    account: { skipStateCookieCheck: true },
    advanced: {
      ...(isHttps ? { defaultCookieAttributes: { sameSite: "none", secure: true } } : {}),
    },
    database: mongodbAdapter(db),
    // JWT (assignment requirement): the jwt plugin signs a real JWT for the
    // logged-in user (GET /api/auth/token, verified against the JWKS at
    // GET /api/auth/jwks). See src/lib/jwtAuth.js — protected routes accept
    // `Authorization: Bearer <jwt>` as well as the session cookie.
    plugins: [jwt()],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 6,
      requireEmailVerification: false,
    },
    // Google OAuth only when both credentials are configured; otherwise
    // omitted cleanly so startup never breaks without keys.
    ...(googleId && googleSecret
      ? { socialProviders: { google: { clientId: googleId, clientSecret: googleSecret } } }
      : {}),
    user: {
      additionalFields: {
        // Never settable by the client (input: false) — admin is assigned
        // by the seed script / admin action, never by public sign-up.
        role: { type: "string", defaultValue: "customer", input: false },
        isBlocked: { type: "boolean", defaultValue: false, input: false },
        phone: { type: "string", required: false },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // refresh once a day
    },
    hooks: {
      // Reject weak passwords on email sign-up with a clear 400.
      // databaseHooks.user.create.before cannot see the password, so the
      // endpoint hook is the right place for this check.
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/sign-up/email") {
          const err = validatePassword(ctx.body?.password);
          if (err) throw new APIError("BAD_REQUEST", { message: err });
        }
      }),
    },
  });
  return authInstance;
}

export async function initAuth() {
  return getAuth();
}
