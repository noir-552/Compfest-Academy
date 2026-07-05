import type { Request, Response } from 'express';
import { advanceDay } from '../lib/clock';
import { runOverdueSweep, getOverdueView } from '../services/overdue.service';
import * as adminService from '../services/admin.service';

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

export async function getOverviewHandler(_req: Request, res: Response): Promise<void> {
  const overview = await adminService.getOverview();
  res.status(200).json(overview);
}

export async function listUsersHandler(_req: Request, res: Response): Promise<void> {
  const users = await adminService.listUsers();
  res.status(200).json({ users });
}

export async function listStoresHandler(_req: Request, res: Response): Promise<void> {
  const stores = await adminService.listStores();
  res.status(200).json({ stores });
}

export async function listProductsHandler(_req: Request, res: Response): Promise<void> {
  const products = await adminService.listProducts();
  res.status(200).json({ products });
}

export async function listOrdersHandler(_req: Request, res: Response): Promise<void> {
  const orders = await adminService.listOrders();
  res.status(200).json({ orders });
}

export async function listDeliveryJobsHandler(_req: Request, res: Response): Promise<void> {
  const jobs = await adminService.listDeliveryJobs();
  res.status(200).json({ jobs });
}
