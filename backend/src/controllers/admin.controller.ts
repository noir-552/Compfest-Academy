import type { Request, Response } from 'express';
import { advanceDay } from '../lib/clock';
import { runOverdueSweep, getOverdueView } from '../services/overdue.service';

/**
 * Advances the virtual clock by one simulated day and immediately runs the
 * overdue sweep against the new "now" — this is the only way orders ever
 * become overdue in this system (there's no real-time cron), so a caller
 * that wants to see refunds/returns happen drives it through this endpoint.
 */
export async function simulateNextDayHandler(_req: Request, res: Response): Promise<void> {
  const virtualDate = await advanceDay();
  const processed = await runOverdueSweep();
  res.status(200).json({ virtualDate, processed });
}

export async function getOverdueHandler(_req: Request, res: Response): Promise<void> {
  const overdue = await getOverdueView();
  res.status(200).json(overdue);
}
