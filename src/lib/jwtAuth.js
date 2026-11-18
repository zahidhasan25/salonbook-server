import { decodeProtectedHeader, importJWK, jwtVerify } from "jose";
import { ObjectId } from "mongodb";
import { getDb } from "../config/db.js";
import { getUserById, publicUser } from "./users.js";

// JWT verification for `Authorization: Bearer <jwt>` (Better Auth jwt plugin).
//
// The jwt plugin signs tokens with a key from the `jwks` collection and
// publishes the public keys at GET /api/auth/jwks. This verifies a token
// against those stored keys with `jose`, exactly like any outside service
// would — issuer/audience are the server's baseURL, matching what the
// plugin signs (see node_modules/better-auth/dist/plugins/jwt/verify.mjs).
//
// Returns the public user object when the token is valid, otherwise null
// (the caller then falls back to the session cookie / 401).

const ISSUER = () => process.env.BASE_URL || "http://localhost:5000";

export async function getJwtUser(req) {
  try {
    const header = req.headers?.authorization || "";
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (!match) return null;
    const token = match[1].trim();
    if (token.split(".").length !== 3) return null;

    const { kid, alg } = decodeProtectedHeader(token);
    if (!kid) return null;

    // The JWKS key id is stored as a BSON ObjectId in `_id` (its 24-hex
    // string form is what the JWT header carries as `kid`); `id` is kept
    // as a fallback for adapters that store it as a plain string.
    let keyId = kid;
    try { keyId = new ObjectId(kid); } catch { /* keep the string */ }
    const keyDoc = await getDb()
      .collection("jwks")
      .findOne({ $or: [{ id: kid }, { _id: keyId }] });
    if (!keyDoc?.publicKey) return null;

    const algorithm = keyDoc.alg || alg || "EdDSA";
    const publicKey = await importJWK(JSON.parse(keyDoc.publicKey), algorithm);
    const { payload } = await jwtVerify(token, publicKey, {
      issuer: ISSUER(),
      audience: ISSUER(),
      algorithms: [algorithm],
    });
    if (!payload?.sub) return null;

    const doc = await getUserById(payload.sub);
    return publicUser(doc);
  } catch {
    return null;
  }
}
