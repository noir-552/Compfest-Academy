import type { Request, Response } from 'express';
import * as deliveryService from '../services/delivery.service';
import { ApiError } from '../lib/api-error';

function requireAuth(req: Request) {
  if (!req.auth) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Not authenticated');
  }
  return req.auth;
}

export async function listAvailableJobsHandler(req: Request, res: Response): Promise<void> {
  requireAuth(req);
  const jobs = await deliveryService.listAvailableJobs();
  res.status(200).json({ jobs });
}

export async function getMyJobsHandler(req: Request, res: Response): Promise<void> {
  const { user } = requireAuth(req);
  const mine = await deliveryService.getMyJobs(user.id);
  res.status(200).json(mine);
}

export async function getJobDetailHandler(req: Request, res: Response): Promise<void> {
  const { user } = requireAuth(req);
  const job = await deliveryService.getJobDetail(user.id, req.params.id as string);
  res.status(200).json({ job });
}

export async function takeJobHandler(req: Request, res: Response): Promise<void> {
  const { user } = requireAuth(req);
  const job = await deliveryService.takeJob(user.id, req.params.id as string);
  res.status(200).json({ job });
}

export async function completeJobHandler(req: Request, res: Response): Promise<void> {
  const { user } = requireAuth(req);
  const job = await deliveryService.completeJob(user.id, req.params.id as string);
  res.status(200).json({ job });
}

export async function getEarningsHandler(req: Request, res: Response): Promise<void> {
  const { user } = requireAuth(req);
  const earnings = await deliveryService.getEarnings(user.id);
  res.status(200).json(earnings);
}
