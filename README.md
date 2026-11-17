# SalonBook — Server

SalonBook is a salon appointment booking platform. Customers browse salon services, request appointments, and pay for confirmed appointments through Stripe. Admins manage services, appointments, customers, and payment transactions.

This repository is the **server** (REST API). The client is a separate repository.

## Features

- **Better Auth** authentication (real library): email sign-up / sign-in, Google OAuth (when keys are configured), session cookies, profile update
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
- **Better Auth** (`better-auth` + mongodb adapter) with session cookies — no JWT, no bcrypt in app code
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

Base URL: `/api`. Protected routes require `Authorization: Bearer <JWT>`.

- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/google`, `GET /api/auth/me`, `PATCH /api/auth/profile`
- `GET /api/services?search=&category=&sort=price_asc|price_desc`, `GET /api/services/:id`, `POST/PUT/DELETE /api/services/:id` (admin), `PATCH /api/services/:id/status` (admin)
- `POST /api/appointments` (customer), `GET /api/appointments/mine` (customer), `GET /api/appointments` (admin), `GET /api/appointments/:id`, `PATCH /api/appointments/:id/status` (admin), `PATCH /api/appointments/:id/cancel` (customer)
- `GET /api/users` (admin), `PATCH /api/users/:id/block` (admin)
- `GET /api/transactions` (admin), `GET /api/transactions/mine` (customer)
- `POST /api/payments/checkout` (customer), `POST /api/payments/webhook` (Stripe, raw body)

## Live Website Link

TODO — add after deployment.

## Repository Links

- Client repository: TODO
- Server repository: TODO

## Notes

- Admin accounts are never created through public registration; use the seed script or create one directly in the database.
- Google sign-in (`POST /api/auth/google`) is a find-or-create placeholder until `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are configured with verified ID-token checking.
- In demo payment mode (`DEMO_PAYMENTS=true`, no Stripe key), checkout returns a demo success URL; payment is only marked paid via the demo webhook event, never by the client alone.

## Authentication (Better Auth)

Auth is **session-cookie based** — the client must send requests with
credentials included (`credentials: "include"` / `withCredentials`), there
is **no Bearer token** anymore.

| Endpoint | Description |
|---|---|
| `POST /api/auth/sign-up/email` | `{ name, email, password }` — password: min 6 chars, 1 upper + 1 lower |
| `POST /api/auth/sign-in/email` | `{ email, password }` |
| `POST /api/auth/sign-in/social` | `{ provider: "google" }` (needs Google keys) |
| `POST /api/auth/sign-out` | Ends the session |
| `GET /api/auth/get-session` | Current session + user |
| `GET /api/auth/me` | Current user (with role / isBlocked / phone) |
| `PATCH /api/auth/profile` | Update own name / image / phone only — role / isBlocked can never change here |

All other `/api/*` routes are unchanged. Blocked users get 403 on every
protected route.
