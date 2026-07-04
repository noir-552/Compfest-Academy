# SEAPEDIA — Design Document

**Date:** 2026-07-04
**Source requirements:** `PRD_SEAPEDIA.md`, `ERD_SEAPEDIA.mermaid`, "Tugas Software Engineering Academy COMPFEST 18.pdf"
**Scope:** All 7 core levels (100 pts) + UI bonus (10 pts). Deployment bonus (15 pts) prepared-for but not executed in this phase.

---

## 1. Goals

Build SEAPEDIA, a multi-role e-commerce marketplace (Guest, Buyer, Seller, Driver, Admin) progressively through Levels 1–7 of the COMPFEST 18 SE Academy technical challenge, with:

- API-based backend with clean separation of concerns (graded criterion).
- One non-admin username owning multiple roles; **authorization by active role**, enforced server-side.
- Full order lifecycle: `Sedang Dikemas → Menunggu Pengirim → Sedang Dikirim → Pesanan Selesai` (+ `Dikembalikan` branch for overdue).
- Single-store cart, wallet payments, PPN 12%, voucher/promo discounts, delivery jobs, admin monitoring, overdue auto-refund/return with audit trail, security hardening (SQLi/XSS/access control), full documentation.
- Progressive git commit history (per assignment: do not squash).
- TDD workflow: failing test → implementation → green, level by level.

## 2. Architecture

### 2.1 Approaches considered

| Approach | Verdict |
|---|---|
| **A. SPA + separate API server (chosen)** — React SPA (`frontend/`) + Express API (`backend/`) in one monorepo | Directly matches "backend is expected to be API-based" and the "clean backend API design & separation of concerns" grading criterion. Each side testable and runnable independently. |
| B. Next.js full-stack monolith | Fast to build, but API routes blur the "separation of concerns" story the graders assess, and server components complicate demonstrating pure-API access control. |
| C. NestJS + React | Strong structure but heavy ceremony for a solo assessed project; Express with a layered structure conveys the same discipline with less magic. |

### 2.2 Stack

- **Backend:** Node.js ≥ 20, TypeScript, Express 5, Prisma ORM, SQLite by default (`DATABASE_URL` switchable to PostgreSQL), Zod for input validation, bcrypt for password hashing.
- **Frontend:** React 19, Vite, TypeScript, React Router (library mode), TanStack Query, Tailwind CSS v4.
- **Tests:** Vitest + Supertest (backend, primary TDD loop, in-memory/file SQLite per test run); Vitest + Testing Library for critical frontend logic (cart rules, checkout summary math display, role guards).
- **API docs:** OpenAPI 3 spec (`backend/openapi.yaml`) served via Swagger UI at `/api/docs`.

### 2.3 Backend layering

```
backend/src/
  routes/        # Express routers: request/response wiring only
  controllers/   # parse+validate (Zod), call service, map errors → HTTP
  services/      # ALL business rules (pure-ish, unit-testable)
  middleware/    # auth (session), requireActiveRole(...), error handler
  lib/           # prisma client, virtual clock, money/tax helpers, token utils
  seed/          # seed script: demo accounts for all 4 roles, products, discounts
prisma/schema.prisma
```

Business rules live only in services; controllers stay thin. This is the separation-of-concerns evidence for grading.

## 3. Data model

Follows `ERD_SEAPEDIA.mermaid` exactly (entities: USER, USER_ROLE, STORE, PRODUCT, ADDRESS, WALLET, WALLET_TRANSACTION, CART, CART_ITEM, ORDER, ORDER_ITEM, ORDER_STATUS_HISTORY, VOUCHER, PROMO, DELIVERY_JOB, APP_REVIEW), with these additions:

- **SESSION** — `id, user_id FK, token_hash UK, active_role nullable, expires_at, created_at`. Backs auth (§4).
- **APP_STATE** — single row: `virtual_date_offset_days int` for time simulation (§9).
- **PRODUCT.is_deleted** (soft delete): products referenced by carts/orders must survive "deletion". Seller delete = soft delete; soft-deleted products vanish from catalog/cart-add and are pruned from carts on read.
- **Address snapshot on ORDER**: `recipient_name_snapshot, phone_snapshot, full_address_snapshot` copied at checkout, so buyers may edit/delete addresses without corrupting order history (ERD deviation, documented).
- **DELIVERY_JOB.status** gains `CANCELLED` (ERD deviation, documented): a job voided by an overdue refund is CANCELLED, never COMPLETED, and excluded from driver job counts/earnings.
- **ORDER.is_voucher_restored** joins `is_refunded` / `is_stock_restored` as idempotency guards for overdue handling (voucher quota is restored on refund, §5.10).
- Money fields are **integer rupiah** (no decimals; IDR has no cents). Prisma `Int`. All rounding is **floor** (§5.2).
- Status/enum-ish strings (`role_type`, `current_status`, `discount_type`, delivery methods, wallet tx types, job status) are strings validated by Zod + service-layer guards (SQLite has no native enums); allowed values documented in the OpenAPI spec.
- **SQLite concurrency:** connection init runs `PRAGMA journal_mode=WAL` and `PRAGMA busy_timeout=5000`; every balance/stock/quota/status mutation uses conditional `updateMany` guards (§5), so races resolve as clean 409s, not `SQLITE_BUSY` 500s.
- **Migrations grow per level** (progressive git history): each level's commit adds only that level's tables/columns. `schema.prisma` is never front-loaded with future levels.

## 4. Authentication & active role

- **Register:** username (unique), email, phone, password (bcrypt, cost 10), initial non-admin role selection (one or more of BUYER/SELLER/DRIVER; admin only via seed/documented setup).
- **Login:** verify hash → create SESSION with 32-byte random token (stored **hashed** SHA-256), `expires_at = now + 7 days` (documented). Response: token + owned roles.
  - If user has exactly one non-admin role → session `active_role` set automatically.
  - If multiple → `active_role = null`; frontend shows role-selection screen; private routes blocked until `POST /api/auth/active-role`.
- **Every request:** `Authorization: Bearer <token>` → middleware loads session (hash lookup, expiry check) → attaches `user`, `activeRole`.
- **Authorization:** `requireActiveRole('SELLER')` etc. on every private endpoint. Ownership checks in services (seller owns store/product, buyer owns order/cart/address, driver owns job). 403 on violation.
- **Logout:** deletes the session row → token truly invalid (Level 7 requirement).
- **Role switching:** allowed mid-session via the same `POST /api/auth/active-role` (only to owned roles); UI shows active role at all times. Active role is **per session (per token)**, a deliberate constraint: two tabs share one role; switching affects the whole session. Documented.
- Admin accounts are seeded (documented in README); admins have only the ADMIN role.

Rationale (vs JWT): opaque DB sessions make logout-invalidation and active-role-on-server trivial and demonstrable; no denylist complexity. Expiry behavior is explicit and documented. Token is sent as `Authorization: Bearer` and stored in localStorage — a deliberate trade-off for API testability (Postman/Swagger graders); the residual XSS-exfiltration risk is mitigated by React auto-escaping + input validation and documented in the security notes.

## 5. Business rules — decisions the assignment leaves to us

These are **the** documented, consistent rules (also go in README + OpenAPI):

1. **Delivery methods, fees, SLA:**
   - INSTANT: fee Rp 25.000, SLA = order date + 1 day
   - NEXT_DAY: fee Rp 15.000, SLA = order date + 2 days
   - REGULAR: fee Rp 10.000, SLA = order date + 4 days
   - `sla_deadline` stored on order at checkout, computed from **virtual now**.
2. **Discount & PPN order of operations (all rounding = floor to whole rupiah):**
   - `discounted_subtotal = subtotal − voucher_discount − promo_discount` (floor 0)
   - Voucher applies first (on subtotal), promo second (on the post-voucher amount). PERCENT discounts floor to whole rupiah.
   - `ppn = floor(0.12 × discounted_subtotal)` — delivery fee is **not** taxed.
   - `final_total = discounted_subtotal + ppn + delivery_fee`
   - Voucher and promo **may be combined** (one of each per order, matching ERD's two FK columns). Same code type cannot be applied twice.
   - Unit tests assert exact totals for known inputs.
3. **Voucher vs promo:** voucher has expiry + usage quota; promo has expiry only. Both validated at checkout time against virtual now; clear distinct labels in validation responses and checkout summary. Voucher quota is decremented with a conditional guard: `updateMany(where: {id, usage_remaining: {gt: 0}})`; affected-rows 0 → 409 "quota exhausted".
4. **Driver earning:** `driver_earning = 80% of delivery_fee` (floored), credited to the job at completion; shown in driver dashboard totals. CANCELLED jobs earn nothing and are excluded from counts. Documented.
5. **Single-store cart:** cart has nullable `store_id`, set on first item; adding an item from another store → 409 with explicit message; UI offers "clear cart & add". Cleared cart resets `store_id`. Add/update validates `quantity ≤ stock` and product not soft-deleted (checkout remains the authoritative backstop). Cart reads prune soft-deleted products.
6. **Checkout transactionally (single Prisma `$transaction`):** validate address ownership, re-validate discounts, decrement stock via conditional `updateMany(where: {id, stock: {gte: qty}})` (no negative stock), debit wallet via conditional `updateMany(where: {id, balance: {gte: total}})` (no negative balance; affected-rows 0 → 409 insufficient balance), create ORDER (+items with name/price snapshots, address snapshot, status history row `SEDANG_DIKEMAS`, `changed_by_role=BUYER`), wallet CHECKOUT_CHARGE transaction, decrement voucher quota (guarded, §5.3), clear cart. Any failure rolls back everything.
7. **Seller processing:** owner-only, race-safe action via conditional `updateMany(where: {id, current_status: 'SEDANG_DIKEMAS'})` → `MENUNGGU_PENGIRIM`; history row `changed_by_role=SELLER`. From Level 5 onward this same transaction also creates the DELIVERY_JOB (status AVAILABLE); Level 4 ships the status change alone.
8. **Driver take-job (race-safe):** conditional `updateMany(where: {id, status: 'AVAILABLE', driver_user_id: null}, ...)`; affected-rows 0 → 409 "already taken". Order → `SEDANG_DIKIRIM`. One active (TAKEN) job per driver at a time. A driver may not take the job for an order they placed as buyer (self-delivery blocked, documented). Complete → conditional update order `SEDANG_DIKIRIM → PESANAN_SELESAI`, job COMPLETED with earning + timestamps. Drivers never see `SEDANG_DIKEMAS` orders (query filters job status AVAILABLE only). A seller buying from their own store is allowed (documented as permitted).
9. **Seller income:** income is recognized at checkout (order paid) and reversed by refund. The income report sums `final_total − ppn_amount − delivery_fee` (= discounted subtotal) over orders where `is_refunded = false`; overdue refunds therefore automatically reverse income, auditable via wallet transactions + status history. This includes not-yet-delivered orders by design (recognized-at-payment model). Rule documented in README.
10. **Overdue sweep (idempotent, race-safe):** for orders past `sla_deadline` and not in `PESANAN_SELESAI`/`DIKEMBALIKAN`: conditional-update status → `DIKEMBALIKAN` (no-op if a driver completed it concurrently; history row `changed_by_role=SYSTEM`), refund `final_total` to buyer wallet (REFUND tx, guarded by `is_refunded`), restore stock per order item (guarded by `is_stock_restored`), restore voucher quota (guarded by `is_voucher_restored`), set linked delivery job → CANCELLED (whether AVAILABLE or TAKEN; no earning). Runs inside a transaction per order; safe to trigger repeatedly — no double refund/reversal/restock ever.

## 6. API surface (summary)

`/api/auth/*` (register, login, logout, me, active-role) · `/api/products` + `/api/products/:id` + `/api/stores/:id` (public) · `/api/reviews` (public GET/POST, app reviews) · `/api/seller/store|products|orders(+process)|report` · `/api/buyer/wallet(+topup)|addresses|cart(+items)|checkout(+preview)|orders|report` · `/api/driver/jobs(available|mine|take|complete)|earnings` · `/api/admin/overview|users|stores|products|orders|vouchers|promos|delivery-jobs|overdue|simulate-next-day` · `/api/discounts/validate` (checkout-time validation) · `/api/docs` (Swagger UI).

Consistent error envelope `{ error: { code, message } }`; 400 validation, 401 unauthenticated, 403 wrong role/ownership, 404, 409 conflict (store name taken, cart store conflict, job taken, insufficient stock/balance).

## 7. Frontend

- **Public:** Landing (hero, marketplace positioning, featured products, review/testimonial section + submit form), product catalog (guest), product detail with store block, store page, login, register.
- **Auth flow:** login → role picker (if multi-role) → role-aware dashboard redirect; active role always visible in navbar; role switcher in menu.
- **Dashboards:** Buyer (wallet + top-up + tx history, addresses, cart, checkout with live summary: subtotal/discount/fee/PPN/total, orders + status timeline, spending report) · Seller (store profile, product CRUD, incoming orders + process action, income report) · Driver (available jobs, my job, history, earnings) · Admin (overview counts, tables for users/stores/products/orders/discounts/jobs/overdue, voucher & promo generate forms, "Simulate next day" button showing sweep results).
- **Reusable UI kit** (Level 1 requirement): Button, Input, Card, Navbar, Footer, Badge (status colors), Modal, Table — used everywhere.
- **Routing:** public routes + `RequireAuth`/`RequireRole` wrappers mirroring backend rules (backend remains the real enforcement).
- Responsive (mobile nav, fluid grids). Reviews rendered as plain text (React escapes by default; no `dangerouslySetInnerHTML` anywhere).
- UI polish pass via the impeccable skill after functional completion (bonus 10 pts target).

## 8. Security (Level 7, designed-in from day 1)

- SQLi: Prisma parameterized queries only; no raw SQL.
- XSS: React auto-escaping; server additionally length-limits and strips control chars; review content stored raw, rendered as text.
- Validation: Zod on every input (email format, phone digits 8–15, rating 1–5 int, qty ≥ 1, price ≥ 0, stock ≥ 0, discount value bounds: PERCENT 1–100, FIXED ≥ 1).
- Sessions: hashed tokens, 7-day expiry, logout deletes, expired sessions rejected.
- Access control: active-role middleware + ownership checks in services; admin endpoints require ADMIN.
- Security test suite: SQLi payloads into login/search/review/checkout, script tags into reviews, cross-user resource access attempts, stale-token access after logout, role-escalation attempts (buyer calling seller endpoints).

## 9. Time simulation & overdue

Virtual clock: `virtualNow() = realNow + APP_STATE.offset_days`. All SLA math uses it. `POST /api/admin/simulate-next-day` increments offset then runs the overdue sweep, returning `{ new_date, processed: [order ids + actions] }` for demo visibility. Manual-trigger approach chosen (assignment explicitly allows it) — deterministic and demoable vs cron.

## 10. Testing strategy (TDD)

- Per level: write failing Supertest specs for the level's endpoints + business rules first, then implement to green. Business-rule unit tests for money math (discount/PPN rounding, exact totals), cart rules, overdue idempotency (run sweep twice → no double refund).
- Edge-case suite (from design review): product soft-deleted while in cart, address edited after order (snapshot intact), discount exceeding subtotal (floor 0), voucher last-quota contention, concurrent take-job, driver blocked from self-delivery, same-user multi-role flow (buyer+seller on own order), insufficient-balance conditional-debit path, sweep-vs-driver-complete interleaving.
- Frontend: unit tests for checkout summary component math display and role-guard routing; manual + gstack `/qa` browser pass per level.
- Full regression suite must stay green before each level's commit.

## 11. Delivery & docs

- README: setup (works on any machine: `npm install && npx prisma migrate dev && npm run seed && npm run dev`), env vars, admin account creation, demo accounts (all 4 roles; one multi-role user), all §5 rule docs, security notes, API docs pointer, e2e demo guide following the assignment's Final Demo Checklist.
- OpenAPI spec covering all endpoints.
- Git: feature commits per sub-task, at minimum one commit per level milestone; no squashing.

## 12. Execution plan (orchestration)

Fable orchestrates; **Opus** agents for deep design/plan review; **Sonnet** agents for implementation ground work; TDD per level; impeccable skill for UI bonus; gstack `/qa` for browser QA. Implementation order = Level 1 → 7, each level: tests → code → green → QA → commit.

## 13. Out of scope

Real payments, product reviews (only app reviews), notifications, search beyond simple filter, i18n, mobile app, deployment execution (prepared via env-based config only).
