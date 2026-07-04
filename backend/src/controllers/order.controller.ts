import type { Request, Response } from 'express';
import * as orderService from '../services/order.service';
import { ApiError } from '../lib/api-error';

function requireAuth(req: Request) {
  if (!req.auth) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Not authenticated');
  }
  return req.auth;
}

export async function listOwnOrdersHandler(req: Request, res: Response): Promise<void> {
  const { user } = requireAuth(req);
  const orders = await orderService.listOwnOrders(user.id);
  res.status(200).json({ orders });
}

export async function getOwnOrderDetailHandler(req: Request, res: Response): Promise<void> {
  const { user } = requireAuth(req);
  const order = await orderService.getOwnOrderDetail(user.id, req.params.id as string);
  res.status(200).json({ order });
}

export async function listIncomingOrdersHandler(req: Request, res: Response): Promise<void> {
  const { user } = requireAuth(req);
  const orders = await orderService.listIncomingOrders(user.id);
  res.status(200).json({ orders });
}

export async function processOrderHandler(req: Request, res: Response): Promise<void> {
  const { user } = requireAuth(req);
  const order = await orderService.processOrder(user.id, req.params.id as string);
  res.status(200).json({ order });
}
