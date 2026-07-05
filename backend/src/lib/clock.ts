import { prisma } from './prisma';

const MS_PER_DAY = 86_400_000;

/**
 * Single time source for all business-time reads (session expiry, SLA
 * deadlines, discount expiry checks, etc). Level 6 introduces a virtual
 * clock: `now()` = real wall clock + `dayOffset` whole days, where
 * `dayOffset` is cached in-process and mirrored in the `AppState` singleton
 * row so it survives process restarts.
 *
 * `now()` itself stays synchronous (every call site expects a plain `Date`
 * back), so the offset is loaded into the cache ahead of time via
 * `loadClockOffset()` at boot; until that resolves (or in tests, which never
 * call it) the cache defaults to 0 — real wall-clock time.
 */
let dayOffset = 0;

export function now(): Date {
  return new Date(Date.now() + dayOffset * MS_PER_DAY);
}

/** Convenience alias for `now()` — reads clearer at call sites that want "today" in admin/reporting views. */
export function getVirtualDate(): Date {
  return now();
}

/**
 * Loads the persisted day offset into the in-process cache. Creates the
 * singleton `AppState` row (id 1) if it doesn't exist yet. Called lazily
 * from the server bootstrap (see `src/server.ts`) before the app starts
 * accepting requests.
 */
export async function loadClockOffset(): Promise<void> {
  const state = await prisma.appState.upsert({
    where: { id: 1 },
    create: { id: 1, dayOffset: 0 },
    update: {},
  });
  dayOffset = state.dayOffset;
}

/**
 * Advances the virtual clock by one day: persists the incremented offset to
 * the `AppState` row (creating it if missing) and updates the in-process
 * cache, then returns the new virtual "now". Used by the admin
 * simulate-next-day endpoint to drive the overdue sweep.
 */
export async function advanceDay(): Promise<Date> {
  const state = await prisma.appState.upsert({
    where: { id: 1 },
    create: { id: 1, dayOffset: 1 },
    update: { dayOffset: { increment: 1 } },
  });
  dayOffset = state.dayOffset;
  return now();
}

/**
 * Test-only helper: pins both the in-process cache and the persisted
 * `AppState` row to `offset`, so tests can reset the virtual clock between
 * cases regardless of what a prior test (or a leftover on-disk test.db)
 * left behind. Not used by production code paths.
 */
export async function _setOffsetForTests(offset: number): Promise<void> {
  await prisma.appState.upsert({
    where: { id: 1 },
    create: { id: 1, dayOffset: offset },
    update: { dayOffset: offset },
  });
  dayOffset = offset;
}
