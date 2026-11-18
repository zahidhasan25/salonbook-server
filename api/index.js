// Vercel serverless entry point — Vercel invokes this exported Express
// app per request. All routes live in src/index.js; the lazy-connect
// middleware there connects MongoDB on the first request of each cold
// start, so no app.listen() is needed (or wanted) here.
import app from "../src/index.js";

export default app;
