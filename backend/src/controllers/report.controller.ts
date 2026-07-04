import type { Request, Response } from 'express';
import * as reportService from '../services/report.service';
import { ApiError } from '../lib/api-error';

function requireAuth(req: Request) {
  if (!req.auth) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Not authenticated');
  }
  return req.auth;
}

export async function getBuyerReportHandler(req: Request, res: Response): Promise<void> {
  const { user } = requireAuth(req);
  const report = await reportService.getBuyerReport(user.id);
  res.status(200).json(report);
}

export async function getSellerReportHandler(req: Request, res: Response): Promise<void> {
  const { user } = requireAuth(req);
  const report = await reportService.getSellerReport(user.id);
  res.status(200).json(report);
}
