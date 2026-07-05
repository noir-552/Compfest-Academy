# Design

Visual system for the SEAPEDIA frontend. Tailwind CSS v4 (`@theme` tokens in `src/index.css`); React 19 + Vite. Color strategy: **Committed** — teal is the identity spine (preserved from the existing codebase and deepened into a deliberate system), an ink-navy chrome anchors nav/sidebars, and a coral accent marks highlights and driver context.

## Color (OKLCH)

Content surface is a true near-white (chroma ~0 — deliberately NOT a warm cream). Chrome (navbar, dashboard rail) is deep ink so the workspace reads as "app". Teal carries primary actions and the marketplace identity; coral is the sparingly-used accent.

- `--color-bg`: `oklch(0.985 0.002 200)` — app content background, near-white cool.
- `--color-surface`: `oklch(1 0 0)` — cards/panels.
- `--color-surface-2`: `oklch(0.965 0.004 200)` — subtle insets, table headers, skeletons.
- `--color-ink`: `oklch(0.23 0.03 235)` — primary text + chrome background (deep blue-slate).
- `--color-ink-soft`: `oklch(0.44 0.02 235)` — secondary text (≥4.5:1 on surface).
- `--color-line`: `oklch(0.9 0.006 220)` — borders/dividers.
- `--color-primary`: `oklch(0.58 0.11 195)` — teal, primary actions.
- `--color-primary-strong`: `oklch(0.5 0.11 195)` — hover/active.
- `--color-primary-tint`: `oklch(0.96 0.03 195)` — selected/hover backgrounds.
- `--color-accent`: `oklch(0.7 0.16 40)` — coral, sparing highlight + driver role.
- Role tints: buyer=teal, seller=indigo `oklch(0.55 0.13 275)`, driver=coral, admin=ink.

## Status color system (order lifecycle — the hero)

Each of the five states has a fixed tone (tint bg + darker ink text + a dot), distinguishable beyond hue by an always-present status dot and label:
- `SEDANG_DIKEMAS` (packing) — amber `oklch(0.75 0.14 75)`
- `MENUNGGU_PENGIRIM` (awaiting driver) — violet `oklch(0.6 0.13 285)`
- `SEDANG_DIKIRIM` (shipping) — sky `oklch(0.62 0.13 235)`
- `PESANAN_SELESAI` (done) — emerald `oklch(0.62 0.12 155)`
- `DIKEMBALIKAN` (returned) — rose `oklch(0.62 0.15 15)`

## Typography

- Family: **Plus Jakarta Sans** (an Indonesian-designed geometric sans — on-brand, distinctive vs the Inter default) via `@fontsource-variable/plus-jakarta-sans`, with `system-ui` fallback. One family, multiple weights (400/500/600/700).
- Numeric/money: `font-variant-numeric: tabular-nums` on all rupiah and quantity displays.
- Fixed rem scale (product register), ratio ~1.2: text-xs .75 / sm .875 / base 1 / lg 1.125 / xl 1.25 / 2xl 1.5 / 3xl 1.875 / 4xl 2.25. Landing hero may go larger via clamp (max ≤ 3.5rem).

## Components

- **Button**: primary (teal), secondary (outline), ghost, danger; states default/hover/active/focus-visible/disabled/loading (spinner). Radius `rounded-lg`.
- **Badge**: neutral/success/warning/info/danger + role tones + the 5 status tones (with dot).
- **StatusPill / OrderStatusTimeline**: the signature component — horizontal stepper on desktop, vertical on mobile; current step highlighted, done steps checked, Dikembalikan branch in rose.
- **Card**: `surface` bg, `line` border, `rounded-xl`, soft shadow; never nested.
- **Input**: label + control + error text; focus ring; error state red border.
- **Table**: sticky-ish header on `surface-2`, zebra-free with `line` row dividers, right-aligned numeric columns.
- **Skeleton**: `surface-2` shimmer blocks for loading; **EmptyState**: icon + heading + one-line teach + optional action.

## Layout & Chrome

- Public pages: centered max-w container, ink navbar with teal logo mark, guest vs auth nav.
- Dashboards: ink top bar + role-colored active-role chip; horizontal tab rail per role; content on `bg`.
- Responsive: nav collapses to a sheet under `md`; tables scroll-x in a bordered container; timeline flips vertical.

## Motion

150–250ms ease-out on hover/focus/state changes; tab underline slide; skeleton shimmer; toast/modal fade+scale. `prefers-reduced-motion: reduce` → instant/crossfade. No page-load choreography.
