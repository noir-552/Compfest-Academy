/**
 * Single time source for all business-time reads (session expiry, SLA
 * deadlines, discount expiry checks, etc). Level 3-4 anchors to the real
 * wall clock; Level 6 introduces a virtual clock, at which point only this
 * function needs to change to return the virtual time instead.
 */
export function now(): Date {
  return new Date();
}
