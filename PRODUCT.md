# Product

## Register

product

## Users

Four roles share one account system, each in a distinct task:
- **Buyer** — browsing a multi-store catalog, managing wallet/addresses, building a single-store cart, checking out with discounts, tracking orders.
- **Seller** — running a store, managing products, processing incoming orders, reading income reports.
- **Driver** — finding available delivery jobs, taking one, confirming completion, tracking earnings.
- **Admin** — monitoring the whole marketplace, generating vouchers/promos, simulating time to trigger overdue refunds.
- **Guest** — browsing the public catalog and leaving app reviews before ever signing up.

Context: an assessor/demo audience moving fast across every role in one sitting, plus, notionally, real marketplace participants on desktop and mobile.

## Product Purpose

SEAPEDIA is a multi-role e-commerce marketplace connecting sellers, buyers, and delivery drivers under admin oversight. Success = every role can complete its full workflow (cart→checkout→process→deliver→settle, plus overdue auto-refund) fluently, and the interface makes the order lifecycle and each role's state legible at a glance.

## Brand Personality

Trustworthy, energetic, operational. A marketplace you'd hand your money to — clear, confident, and quick — not a toy demo. Three words: **dependable, lively, legible.**

## Anti-references

- Generic teal-on-white SaaS boilerplate (unstyled Tailwind defaults, no committed identity) — the trap this project starts in.
- Fintech navy-and-gold seriousness; SEAPEDIA is commerce, not banking.
- Over-decorated consumer-shopping maximalism (gradients, confetti, promo clutter).

## Design Principles

1. **The lifecycle is the hero.** The five order states (Sedang Dikemas → Menunggu Pengirim → Sedang Dikirim → Pesanan Selesai, with the Dikembalikan branch) get a first-class, consistent visual language everywhere they appear.
2. **Role is always legible.** Active role and the workspace you're in are never ambiguous — chrome, badges, and accents make the current context obvious.
3. **Money is unambiguous.** Rupiah, discounts, PPN, refunds render precisely and calmly; the checkout summary is the most trustworthy surface in the app.
4. **Earned familiarity.** Standard product affordances (top nav, tabs, tables, status badges) done cleanly beat invented ones. The tool disappears into the task.
5. **Every state is designed.** Loading (skeletons), empty (teaching), and error states are treated as real screens, not afterthoughts.

## Accessibility & Inclusion

WCAG 2.1 AA: body text ≥4.5:1, status colors distinguishable by more than hue (icon/label + tint), visible focus rings on every interactive element, full keyboard operability, `prefers-reduced-motion` honored. Indonesian-language UI.
