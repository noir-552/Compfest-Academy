# SEAPEDIA

SEAPEDIA is a multi-role, multi-store e-commerce marketplace built for the
COMPFEST 18 Software Engineering Academy technical challenge. It connects
four roles — **Buyer**, **Seller**, **Driver**, and **Admin** — in one
platform, with a single username able to hold multiple non-admin roles at
once (e.g. Buyer + Seller + Driver), gated by a server-verified **active
role** per session.

This document is written for an evaluator running the project from scratch.
It covers setup, environment variables, demo accounts, every documented
business rule (with worked examples), security notes, API docs, and an
end-to-end demo script.

---

## Table of contents

- [Overview & scope (7 levels)](#overview--scope-7-levels)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Setup](#setup)
- [Environment variables](#environment-variables)
- [Creating an admin account](#creating-an-admin-account)
- [Demo accounts](#demo-accounts)
- [Business rules](#business-rules-documented)
- [Security notes](#security-notes)
- [API documentation](#api-documentation)
- [End-to-end demo guide](#end-to-end-demo-guide)
- [Testing notes](#testing-notes)
- [Git history](#git-history)

---

## Overview & scope (7 levels)

The project is built progressively, one graded level at a time:

| Level | Scope | Points |
|---|---|---|
| 1 | Public marketplace, auth (register/login/logout), multi-role + active-role selection, public app reviews | 20 |
| 2 | Seller store + product CRUD, catalog wired to real backend data | 15 |
| 3 | Buyer wallet + top-up, addresses, single-store cart, checkout (subtotal + delivery fee + PPN 12%), order history | 20 |
| 4 | Voucher/Promo discounts, seller order processing, buyer/seller reports | 15 |
| 5 | Delivery job workflow: driver search/take/complete, race-safe job taking, earnings | 10 |
| 6 | Admin monitoring dashboard, virtual-clock day simulation, idempotent auto-refund/return for overdue orders | 10 |
| 7 | Security hardening (SQLi/XSS/RBAC/session/rate-limit), seed data, OpenAPI docs, this README | 10 |

Core total: **100 points**. Bonus: creative/intuitive UI (10), public
deployment (15) — tracked separately from the core deliverables above.

## Tech stack

**Backend:** Node.js, Express 5, TypeScript (strict), Prisma 7 ORM with the
`@prisma/adapter-better-sqlite3` driver adapter, SQLite, Zod validation,
bcryptjs password hashing, Vitest + Supertest.

**Frontend:** React 19, Vite, TypeScript, React Router 7, TanStack Query,
Tailwind CSS v4, Vitest + Testing Library.

## Architecture

Monorepo with two independent npm packages:

```
backend/
  prisma/schema.prisma      # all models (User, Store, Product, Cart, Order, ...)
  prisma/migrations/        # one migration per level, applied progressively
  src/
    routes/       # Express routers — one file per resource group, mounts middleware
    controllers/  # HTTP layer: parses/validates (Zod), calls services, shapes responses
    services/     # business logic + Prisma queries, no req/res
    lib/          # cross-cutting: money math, virtual clock, prisma client, tokens, roles
    middleware/   # auth (bearer session), RBAC (active-role), rate-limit, error envelope
    seed/         # admin.ts (admin-only) and seed.ts (full demo dataset)
  tests/          # Vitest + Supertest, one file per feature area
  openapi.yaml    # OpenAPI 3.0 spec, served at /api/docs and /api/openapi.json

frontend/
  src/
    pages/        # route-level components, incl. per-role dashboards under pages/dash/
    ui/            # reusable components (Button, Input, Card, Navbar, Footer, Modal, Table)
    auth/          # AuthContext, RequireAuth/RequireRole route guards
    cart/          # CartContext
```

Layering on the backend is strict: **routes → controllers → services →
Prisma**. Controllers never touch Prisma directly; services never touch
`req`/`res`. Every mutating multi-step operation (checkout, job take/complete,
overdue sweep) runs inside a Prisma interactive transaction with conditional
`updateMany` guards, so concurrent requests can't double-apply an effect.

## Setup

Prerequisite: **Node.js ≥ 20**.

### Docker demo setup

Prerequisite: Docker with Docker Compose.

```bash
docker compose up --build
```

Open the frontend at `http://localhost:5173`. The backend API is available at
`http://localhost:3001`.

The backend container automatically runs Prisma generation, applies committed
migrations, seeds the demo data, and starts the API. SQLite data is stored in
the `backend-data` Docker volume, so it survives container restarts. To reset
the demo database from scratch:

```bash
docker compose down -v
docker compose up --build
```

### Backend

```bash
cd backend
npm install
npx prisma generate # creates node_modules/.prisma/client after install
npm run db:migrate   # applies all migrations — see note below
npm run seed          # creates demo accounts, stores, products, discounts
npm run dev            # starts the API on http://localhost:3001
```

> **Why `db:migrate` runs `prisma migrate deploy`, not `migrate dev`:** one
> early migration (the `AppState` singleton table) carries a cosmetic
> `AUTOINCREMENT` artifact that `prisma migrate dev` would try to "fix" by
> regenerating/diffing the migration history, which on SQLite can drop and
> recreate tables. `migrate deploy` only ever applies migrations forward,
> exactly as committed — the correct command for any environment (including
> this evaluation) that isn't actively authoring new migrations.

### Frontend

```bash
cd frontend
npm install
npm run dev   # starts Vite on http://localhost:5173
```

Vite's dev server proxies `/api/*` requests to `http://localhost:3001` (see
`frontend/vite.config.ts`), so the frontend and backend must both be running,
but the browser only ever talks to port 5173.

### Ports

| Service | Port |
|---|---|
| Backend API | 3001 |
| Frontend (Vite) | 5173 |

## Environment variables

Backend `.env` (see `backend/.env.example`):

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | SQLite connection string (Prisma driver-adapter URL format) |
| `PORT` | `3001` | HTTP port the Express server listens on |

The frontend has no required environment variables for local dev — the Vite
proxy handles routing to the backend.

## Creating an admin account

ADMIN is intentionally **not** self-registerable (`POST /api/auth/register`
only accepts `SELLER`/`BUYER`/`DRIVER` — see `backend/src/lib/roles.ts`).
There are two ways to get an admin account:

1. **`npm run seed`** — creates `admin` / `admin123` as part of the full demo
   dataset (see [Demo accounts](#demo-accounts)).
2. **`npm run create-admin`** — a dedicated, idempotent script for
   provisioning just an admin, independent of the rest of the seed data.
   Configurable via env vars or CLI flags:

   ```bash
   npm run create-admin
   # or
   ADMIN_USERNAME=myadmin ADMIN_PASSWORD=supersecret npm run create-admin
   # or
   npm run create-admin -- --username=myadmin --password=supersecret
   ```

   Defaults to `admin` / `admin123` if nothing is provided. Both scripts
   upsert by username, so re-running either is always safe.

## Demo accounts

Created by `npm run seed` (idempotent — safe to re-run any time; it only
upserts/creates missing rows, never duplicates or errors):

| Role(s) | Username | Password | Notes |
|---|---|---|---|
| ADMIN | `admin` | `admin123` | Creates vouchers/promos, full monitoring dashboard |
| SELLER | `toko_maju` | `password123` | Store "Toko Maju" — 5 products (food & drinks) |
| SELLER | `sinar_jaya` | `password123` | Store "Sinar Jaya" — 3 products (apparel) |
| BUYER | `budi` | `password123` | Wallet pre-topped to 1,000,000, one default address |
| DRIVER | `kurir_cepat` | `password123` | No active job initially |
| BUYER + SELLER + DRIVER | `rangga` | `password123` | Store "Rangga Store" — 2 products, wallet 500,000, one address. Must pick an active role after login (multi-role account) |

Products carry an optional `imageUrl` (nullable string, must start with `https://`, `http://`, or `/`); all 10 seeded demo products ship with real photos under `frontend/public/product-images/`, and the frontend falls back to a gray placeholder wherever a product has no image or its photo fails to load.

Discount codes seeded for demo checkout:

| Code | Type | Value | Notes |
|---|---|---|---|
| `HEMAT10` | Voucher, PERCENT | 10% | Usage quota 5, expires 30 days from seed time |
| `PROMOHEMAT` | Promo, FIXED | Rp 5,000 | Expires 30 days from seed time |

## Business rules (documented)

Every rule below is implemented in `backend/src/lib/money.ts`,
`backend/src/lib/clock.ts`, and `backend/src/services/*` — this section
states each one precisely, as required for Level 7.

### Delivery fees & SLA

| Method | Delivery fee | SLA (auto-return deadline) |
|---|---|---|
| `INSTANT` | Rp 25,000 | 1 day |
| `NEXT_DAY` | Rp 15,000 | 2 days |
| `REGULAR` | Rp 10,000 | 4 days |

The SLA deadline is set at checkout time as `now() + SLA_DAYS[method]` days.
If an order hasn't reached a final status (`PESANAN_SELESAI` or
`DIKEMBALIKAN`) by its deadline, the next overdue sweep force-returns it.

### Discount combination + PPN order (checkout math)

Order of operations, applied in exactly this sequence:

1. **Voucher first**, computed on the full `subtotal`:
   - `PERCENT`: `floor(discountValue * subtotal / 100)`
   - `FIXED`: `discountValue` — capped at `subtotal`
2. **Promo second**, computed on the *remainder after the voucher*
   (`subtotal - voucherAmount`):
   - `PERCENT`: `floor(discountValue * remainder / 100)`
   - `FIXED`: `discountValue` — capped at that remainder
3. `discountAmount = min(voucherAmount + promoAmount, subtotal)` (never
   negative, never more than the subtotal)
4. **PPN 12%**, computed on the discounted subtotal:
   `ppnAmount = floor(0.12 * (subtotal - discountAmount))`
5. **Final total**:
   `finalTotal = (subtotal - discountAmount) + ppnAmount + deliveryFee`

All rounding is `Math.floor` (never round-half-up), applied at each discount
step independently before summing — see `backend/src/lib/money.ts` and the
commit `fix(backend): multiply-before-divide in percent discounts (floor
exactness)` for why the multiplication happens before the division.

**Worked example** — subtotal Rp 100,000, `REGULAR` delivery, both `HEMAT10`
(PERCENT 10) and `PROMOHEMAT` (FIXED 5000) applied:

```
voucherAmount   = floor(10 * 100000 / 100)        = 10,000
remainder       = 100000 - 10000                  = 90,000
promoAmount     = min(5000, 90000)                = 5,000
discountAmount  = min(10000 + 5000, 100000)       = 15,000
taxable         = 100000 - 15000                  = 85,000
ppnAmount       = floor(0.12 * 85000)              = 10,200
deliveryFee (REGULAR)                              = 10,000
finalTotal      = 85000 + 10200 + 10000            = 105,200
```

**Capped-discount edge case:** if voucher + promo would exceed the subtotal,
each is capped *independently* — the voucher against the full subtotal, the
promo against the voucher-reduced remainder — and `discountAmount` is
separately capped at the subtotal. This means the per-code breakdown shown to
the buyer (`discounts.voucher.amount` + `discounts.promo.amount`) can be
strictly greater than the order's actual `discountAmount`; do not assume they
sum to it. Example: subtotal 8,000 with a FIXED 5,000 voucher and FIXED 5,000
promo — voucher takes 5,000, remainder is 3,000, so promo is capped at 3,000
(not 5,000); `discountAmount = min(5000+3000, 8000) = 8000` regardless.

### Single-store cart rule

A cart may only ever contain products from **one store at a time**. Adding a
product from a different store than what's already in the cart is rejected
with `409 CART_STORE_CONFLICT` — the buyer must clear the cart first. The
cart's effective store is recomputed on every read (soft-deleted products are
pruned first), so this check always reflects live state, not a stale
`storeId`.

### Driver earning

`driverEarning = floor(0.8 * order.deliveryFee)`, computed and stored on the
`DeliveryJob` row the moment the driver marks the job **completed** (not when
it's taken). Example: `REGULAR` delivery fee 10,000 → driver earns
`floor(0.8 * 10000) = 8,000`.

### Seller income (report)

`income = sum(finalTotal - ppnAmount - deliveryFee)` over the seller's
**non-refunded** orders — i.e. the seller's net cut after tax and the
delivery fee that flows to the driver, not the buyer's full payment.
Recognized at checkout time; reversed automatically the moment an order is
refunded (its `isRefunded` flag flips to true, which excludes it from the sum
on every subsequent report read — no separate "reversal" write needed).

### Overdue sweep (auto refund / return)

Driven by `POST /api/admin/simulate-next-day` (there is no real-time cron in
this system — the virtual clock only advances when this endpoint is called).
For every order whose `slaDeadline` has passed and isn't yet in a final
status:

1. `currentStatus` → `DIKEMBALIKAN` (terminal — the overdue branch off the
   happy path `SEDANG_DIKEMAS → MENUNGGU_PENGIRIM → SEDANG_DIKIRIM →
   PESANAN_SELESAI`)
2. Refund `finalTotal` to the buyer's wallet + a `REFUND` wallet-transaction
   audit row
3. Restore each order item's product stock
4. Restore the voucher's usage quota, if one was used
5. Cancel any `AVAILABLE`/`TAKEN` delivery job for that order

Every one of those five effects is guarded by its own idempotency flag
(`isRefunded`, `isStockRestored`, `isVoucherRestored`, plus the
`currentStatus`/job-status checks themselves) via a conditional `updateMany`,
so running the sweep against the same order twice — or racing it against a
concurrent driver action — never double-refunds, double-restocks, or
double-credits a voucher. Every status change is written to
`OrderStatusHistory` with `changedByRole: 'SYSTEM'`.

**To simulate this in the demo:** log in as `admin`, go to
**Admin → Simulate** (`/dashboard/admin/simulate`), and click "Simulate Next
Day" — or `curl -X POST /api/admin/simulate-next-day` with the admin bearer
token. Repeat until an order's SLA deadline is in the past (REGULAR orders
need 4 simulated days).

### Session expiry & logout

Sessions are opaque random tokens (32 bytes, SHA-256-hashed at rest — see
`backend/src/lib/tokens.ts`), valid for **7 days** from login
(`expiresAt = now() + 7 days`). `POST /api/auth/logout` **deletes** the
session row outright — the token is dead immediately on the server, not just
forgotten client-side. An expired-but-not-logged-out session is rejected the
same way (`401 UNAUTHENTICATED`) the instant `now() > expiresAt` on any
subsequent request.

## Security notes

- **SQL injection:** all database access goes through Prisma's query builder
  (parameterized under the hood); the only raw SQL in the codebase is two
  fixed `PRAGMA` statements at connection setup (`journal_mode=WAL`,
  `busy_timeout=5000`) in `backend/src/lib/prisma.ts` — no user input ever
  reaches a raw query. Covered by `backend/tests/security.test.ts` (SQLi
  payloads as login username, product search, review fields, discount codes
  — all rejected/neutralized, never bypass auth or dump data).
- **XSS:** the backend stores review/product text verbatim as plain strings
  and returns it as `application/json` (never HTML), so there's no
  server-side injection point; the frontend (React) escapes all rendered
  text by default, so `<script>`/`onerror=` payloads render as inert text,
  never execute. Tested end-to-end in `security.test.ts`.
- **Input validation:** every request body is parsed through a Zod schema
  (email format, phone digit-length, rating 1–5, non-negative price/stock,
  quantity ≥ 1, discount value ranges, code patterns, etc.) before touching a
  service; failures return `400 VALIDATION_ERROR` with the same error
  envelope as every other error.
- **Session invalidation:** see [Session expiry & logout](#session-expiry--logout)
  above — logout is a real server-side session delete, not a client-only
  token discard.
- **RBAC by active role, enforced server-side:** every private route group
  (`/api/seller/*`, `/api/buyer/*`, `/api/driver/*`, `/api/admin/*`) is
  gated by `requireActiveRole(...)` middleware that reads the *session's*
  `activeRole` column — never a client-supplied header or route path — so
  switching the frontend's route doesn't grant access; a multi-role account
  that hasn't activated `SELLER` still gets `403 WRONG_ROLE` on seller
  endpoints even though it owns that role.
- **Cross-user protection:** every owned-resource lookup (products,
  addresses, orders, delivery jobs) scopes the query to the caller's own
  `userId`/`storeId` and returns `404` (not `403`) for another user's
  resource, so a probing request can't even confirm the resource exists.
  Product ownership specifically returns `403 NOT_OWNER` (existence is
  already public via the catalog).
- **Body-size cap:** `express.json({ limit: '100kb' })` rejects oversized
  payloads with `413 PAYLOAD_TOO_LARGE` before they ever reach validation —
  comfortably above every real request shape (the largest legitimate inputs,
  review comments and product descriptions, are capped under 2kb by their
  own Zod schemas).
- **Login rate limiting:** an in-memory, per-IP guard blocks further login
  attempts with `429 TOO_MANY_ATTEMPTS` after 10 failed attempts within a
  60-second window (counts only failures, never successful logins, so
  legitimate traffic is never penalized).

## API documentation

Full OpenAPI 3.0 spec: `backend/openapi.yaml`, covering every endpoint
grouped by tag (auth, reviews, catalog, seller, buyer, driver, admin,
discounts) — request/response shapes, the bearer auth scheme, active-role
requirements, every enum (roles, order statuses, delivery methods, discount
types), and the shared error envelope.

With the backend running:

- **Swagger UI:** http://localhost:3001/api/docs
- **Raw spec as JSON:** http://localhost:3001/api/openapi.json

## End-to-end demo guide

Follows the assignment's Final Demo Checklist. Backend on `:3001`, frontend
on `:5173` (or use `curl` directly against `:3001` for the API-only steps).

### 1. Guest browsing + public review

- Visit `http://localhost:5173/` → browse the landing page and `/catalog`
  without logging in.
- Open a product detail page (`/product/:id`) and a store page
  (`/stores/:id`) — all real seeded data (Toko Maju, Sinar Jaya, Rangga
  Store).
- Submit a public app review from the landing page (name, 1–5 rating,
  comment) without an account — confirm it appears in the review list as
  plain text (try an XSS payload like `<script>alert(1)</script>` to see it
  render inertly).

### 2. Register → login → role selection

- Register a new account choosing one or more of Buyer/Seller/Driver.
- Log in. If you registered with a single role, you land directly in that
  role's dashboard. If multi-role, you're routed to `/select-role` first —
  server rejects any private-route call until an active role is set.
- Check `/profile` — shows owned roles + current active role.

### 3. Seller: store + products

- Log in as `toko_maju` / `password123` (already has a store + 5 products),
  or register a fresh Seller and create a store at
  `/dashboard/seller/store`.
- Add/edit/delete a product under `/dashboard/seller/store` — confirm the
  new product shows up in the public catalog immediately.

### 4. Buyer: wallet, cart, checkout (with discount)

- Log in as `budi` / `password123` (wallet already at 1,000,000).
- `/dashboard/buyer/wallet` — top up more if desired.
- Add a Toko Maju product to the cart (`/dashboard/buyer/cart`); try adding a
  Sinar Jaya product too and confirm the `409 CART_STORE_CONFLICT` /
  single-store warning.
- Go to `/dashboard/buyer/checkout`, add an address if none exists, pick a
  delivery method, enter `HEMAT10` and/or `PROMOHEMAT`, and confirm the
  preview totals match the [worked example](#discount-combination--ppn-order-checkout-math) math exactly before
  committing.
- Confirm the order appears in `/dashboard/buyer/orders` with status
  `SEDANG_DIKEMAS`.

### 5. Seller processes the order

- Log in as the product's seller (`toko_maju`), go to
  `/dashboard/seller/orders`, and click "Process" on the new order — status
  flips to `MENUNGGU_PENGIRIM` and a delivery job is created.

### 6. Driver takes and completes the job

- Log in as `kurir_cepat` / `password123`, go to
  `/dashboard/driver/available`, take the job (order → `SEDANG_DIKIRIM`).
- Go to `/dashboard/driver/mine` and mark it completed (order →
  `PESANAN_SELESAI`); confirm the earning (`floor(0.8 * deliveryFee)`) shows
  up in `/dashboard/driver/earnings`.

### 7. Reports

- As the buyer, check `/dashboard/buyer/report` — spend total excludes any
  refunded orders.
- As the seller, check `/dashboard/seller/report` — income excludes PPN and
  delivery fee.

### 8. Admin: monitoring + overdue simulation

- Log in as `admin` / `admin123`.
- Browse `/dashboard/admin/overview`, `/users`, `/stores`, `/products`,
  `/orders`, `/jobs` — full read-only monitoring.
- Create a fresh voucher/promo at `/dashboard/admin/discounts`.
- Place a *new* order as a buyer and leave it unprocessed, then go to
  `/dashboard/admin/simulate` and click "Simulate Next Day" repeatedly (4
  times for a REGULAR order) until its SLA deadline passes — confirm on
  `/dashboard/admin/overdue` that it flips to `DIKEMBALIKAN`, the buyer's
  wallet is refunded exactly `finalTotal`, stock is restored, and (if a
  voucher was used) its quota is restored. Click "Simulate Next Day" again
  immediately after — confirm nothing double-applies (idempotent).

### 9. Security spot-check

- Try changing the frontend URL directly to `/dashboard/admin/overview`
  while logged in as a Buyer — the route guard blocks it client-side, and
  the underlying API call would 403 server-side regardless.
- Log out, then reuse the old bearer token against any private endpoint
  (e.g. via `curl`) — confirm `401 UNAUTHENTICATED`.

## Testing notes

Backend: `cd backend && npx vitest run` (286 tests across 19 files, all
green). Frontend: `cd frontend && npx vitest run`.

**IPv6 loopback quirk:** the backend test suite's HTTP client
(`tests/setup.ts`) rewrites Supertest's `127.0.0.1` target to `[::1]` and
disables Node's keep-alive agent. This works around two flakiness sources
observed on macOS during development: Node ≥19's keep-alive socket pooling
occasionally reusing a stale socket from a previous ephemeral test server,
and the OS occasionally routing a `127.0.0.1`-targeted connection to an
unrelated IPv4-only process squatting on the same ephemeral port. Neither is
specific to this app's code — just an artifact of Supertest booting a fresh
ephemeral-port server per test file on this OS.

## Git history

Commit history is progressive and intentionally **not squashed** — one (or a
small few) commits per level/feature, in the order the corresponding
functionality was actually built, so the evolution from Level 1 through
Level 7 is visible in `git log`.
