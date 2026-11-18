# SalonBook — Server

SalonBook is a salon appointment booking platform. Customers browse salon services, request appointments, and pay for confirmed appointments through Stripe. Admins manage services, appointments, customers, and payment transactions.

This repository is the **server** (REST API). The client is a separate repository.

## Features

- **Better Auth** authentication (real library): email sign-up / sign-in, Google OAuth (when keys are configured), session cookies, profile update
- **JWT**: Better Auth jwt plugin — `GET /api/auth/token` issues a signed JWT for the logged-in user, verified against the JWKS at `GET /api/auth/jwks`; protected routes accept `Authorization: Bearer <JWT>` as well as the session cookie
- Role-based access: `customer` and `admin`, verified server-side on every protected route
- Blocked users cannot access protected features
- Services: search by name, filter by category, sort by price, admin CRUD + activate/deactivate, ImgBB image upload
- Appointments: booking with date/time-slot validation, duplicate-appointment conflict check (409), admin confirm/cancel, customer cancel of pending appointments only
- Payments: Stripe Checkout for confirmed, unpaid appointments; payment status is updated **only** by a verified Stripe webhook (`checkout.session.completed`)
- Transactions recorded from the webhook; admin cannot manually mark payments as paid
- Central error handling, no stack traces leaked in production

## Technology Stack

- Node.js (>= 20), Express.js (ES modules)
- **Real MongoDB** with Mongoose (required — no in-memory/demo database; see `ATLAS_SETUP.md`)
- **Better Auth** (`better-auth` + mongodb adapter) with session cookies and the **jwt plugin** (signed JWTs, JWKS) — no bcrypt in app code
- Stripe, ImgBB (via `axios`), Multer (image upload)

## Installation

```bash
npm install
cp .env.example .env   # fill in your values (never commit .env)
```

## How to Run the Project Locally

```bash
npm run dev     # start the server (default port 5000)
npm run seed    # seed admin + demo customer + 8 services (idempotent)
npm start       # production start
```

Health check: `GET http://localhost:5000/api/health` → `{ "ok": true }`

## Required Environment Variables

Names only — never put real secret values in code or in a README:

| Variable | Purpose |
|---|---|
| `PORT` | Server port (default 5000) |
| `MONGODB_URI` | **Required.** Real MongoDB connection string — local `mongodb://127.0.0.1:27017/salonbook` or Atlas `mongodb+srv://...` (see `ATLAS_SETUP.md`). Server refuses to start without it. |
| `BETTER_AUTH_SECRET` | Better Auth secret (min 32 chars, e.g. `openssl rand -base64 32`) — signs session cookies. |
| `BASE_URL` | Server base URL for Better Auth (default http://localhost:5000) |
| `CLIENT_URL` | Allowed client origin for CORS (default http://localhost:3000) |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `IMGBB_API_KEY` | ImgBB API key for image uploads |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `DEMO_PAYMENTS` | `true` enables demo checkout when no Stripe key is set |

## Demo Accounts (seeded by `npm run seed`)

| Role | Email | Password |
|---|---|---|
| Admin | admin@salonbook.com | Admin123 |
| Customer | demo@salonbook.com | Customer123 |

## API Overview

Base URL: `/api`. Protected routes accept the session cookie (`credentials: "include"`) or `Authorization: Bearer <JWT>` (see Authentication).

- `POST /api/auth/sign-up/email`, `POST /api/auth/sign-in/email`, `POST /api/auth/sign-in/social` (Google), `POST /api/auth/sign-out`, `GET /api/auth/get-session`, `GET /api/auth/token` (JWT), `GET /api/auth/jwks`, `GET /api/auth/me`, `PATCH /api/auth/profile`
- `GET /api/services?search=&category=&sort=price_asc|price_desc`, `GET /api/services/:id`, `POST/PUT/DELETE /api/services/:id` (admin), `PATCH /api/services/:id/status` (admin)
- `POST /api/appointments` (customer), `GET /api/appointments/mine` (customer), `GET /api/appointments` (admin), `GET /api/appointments/:id`, `PATCH /api/appointments/:id/status` (admin), `PATCH /api/appointments/:id/cancel` (customer)
- `GET /api/users` (admin), `PATCH /api/users/:id/block` (admin)
- `GET /api/transactions` (admin), `GET /api/transactions/mine` (customer)
- `POST /api/payments/checkout` (customer), `POST /api/payments/webhook` (Stripe, raw body)

## Live Website Link

TODO — add after deployment.

## Deploy on Vercel (server)

The server runs as a Vercel serverless function — no separate host needed:

1. Import the `salonbook-server` repo on Vercel (Add New → Project → Import).
2. Framework Preset: **Other**. Root Directory: repo root (default).
3. Add the same Environment Variables as in `.env.example` (Atlas `MONGODB_URI`,
   `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`,
   Stripe keys, `IMGBB_API_KEY`), with:
   - `BASE_URL` = your Vercel server URL, e.g. `https://salonbook-server.vercel.app`
   - `CLIENT_URL` = your Vercel client URL, e.g. `https://salonbook-client.vercel.app`
4. Deploy. All routes are served by `api/index.js` (see `vercel.json`); locally
   nothing changes — `npm run dev` still listens on port 5000.
5. After both URLs exist, update the Google OAuth client (add the Vercel client
   origin + `https://<server>/api/auth/callback/google` redirect) and the Stripe
   webhook endpoint (`https://<server>/api/payments/webhook`, new `whsec_` secret
   into Vercel env vars, then redeploy).

## Repository Links

- Client repository: https://github.com/zahidhasan25/salonbook-client
- Server repository: https://github.com/zahidhasan25/salonbook-server

## Notes

- Admin accounts are never created through public registration; use the seed script or create one directly in the database.
- Google sign-in is real Better Auth Google OAuth (`POST /api/auth/sign-in/social`, provider `google`); it is only enabled when `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are set in `.env`.
- In demo payment mode (`DEMO_PAYMENTS=true`, no Stripe key), Pay Now opens a demo card form (any 16-digit number is accepted, e.g. 4242 4242 4242 4242; the card is never sent to the server or stored) and checkout returns a demo success URL; payment is only marked paid via the demo webhook event, never by the client alone.

## Authentication (Better Auth + JWT)

Auth is **session-cookie based** — the client must send requests with
credentials included (`credentials: "include"` / `withCredentials`).
Protected routes also accept a **JWT**: after signing in, call
`GET /api/auth/token` (with the session cookie) to get a signed JWT
(EdDSA, 15-minute expiry, `sub` = user id, `iss`/`aud` = server base URL),
then send it as `Authorization: Bearer <token>`. The server verifies it
against the public keys in the `jwks` collection (`src/lib/jwtAuth.js`,
`jose`); the keys are also published at `GET /api/auth/jwks` so any
outside service can verify tokens the same way. A bad or expired token
gets 401, and role checks (admin/customer) and the blocked-user check
(403) still apply exactly as with the session cookie.

| Endpoint | Description |
|---|---|
| `POST /api/auth/sign-up/email` | `{ name, email, password }` — password: min 6 chars, 1 upper + 1 lower |
| `POST /api/auth/sign-in/email` | `{ email, password }` |
| `POST /api/auth/sign-in/social` | `{ provider: "google" }` (needs Google keys) |
| `POST /api/auth/sign-out` | Ends the session |
| `GET /api/auth/get-session` | Current session + user |
| `GET /api/auth/token` | Signed JWT for the logged-in user (session required) |
| `GET /api/auth/jwks` | Public JWKS keys for verifying JWTs |
| `GET /api/auth/me` | Current user (with role / isBlocked / phone) |
| `PATCH /api/auth/profile` | Update own name / image / phone only — role / isBlocked can never change here |

All other `/api/*` routes are unchanged. Blocked users get 403 on every
protected route.
