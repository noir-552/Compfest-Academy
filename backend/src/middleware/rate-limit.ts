import type { Request } from 'express';
import { ApiError } from '../lib/api-error';

/**
 * Minimal in-memory brute-force guard for POST /api/auth/login, scoped
 * per client IP.
 *
 * Deliberately counts only FAILED attempts (INVALID_CREDENTIALS), not every
 * login call: the rest of the test suite makes dozens of successful
 * register+login round trips per file (driver.test.ts alone drives 30+), all
 * from the same loopback address, and those must never trip this guard. A
 * real credential-stuffing/brute-force script is exactly the
 * failure-heavy pattern this is meant to catch — a legitimate user who gets
 * their own password right doesn't accumulate anything.
 *
 * Single-process, in-memory only — fine for this app's single instance; a
 * horizontally-scaled deployment would move this to a shared store (Redis).
 */

const WINDOW_MS = 60_000;
const MAX_FAILURES = 10;

interface Bucket {
  failures: number;
  windowStart: number;
}

let buckets = new Map<string, Bucket>();

function keyFor(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

/** Throws 429 if this IP has exceeded the failed-login budget for the current window. */
export function assertLoginNotRateLimited(req: Request): void {
  const key = keyFor(req);
  const bucket = buckets.get(key);
  if (!bucket) return;

  if (Date.now() - bucket.windowStart > WINDOW_MS) {
    buckets.delete(key);
    return;
  }

  if (bucket.failures >= MAX_FAILURES) {
    throw new ApiError(429, 'TOO_MANY_ATTEMPTS', 'Too many failed login attempts. Try again later.');
  }
}

/** Records one failed login attempt for this IP, starting a fresh window if the previous one expired. */
export function recordLoginFailure(req: Request): void {
  const key = keyFor(req);
  const bucket = buckets.get(key);
  const nowMs = Date.now();

  if (!bucket || nowMs - bucket.windowStart > WINDOW_MS) {
    buckets.set(key, { failures: 1, windowStart: nowMs });
    return;
  }

  bucket.failures += 1;
}

/** Clears this IP's failure count on a successful login. */
export function recordLoginSuccess(req: Request): void {
  buckets.delete(keyFor(req));
}

/** Test-only: wipes all rate-limit state so test files/cases don't bleed into each other. */
export function _resetLoginRateLimiterForTests(): void {
  buckets = new Map();
}
