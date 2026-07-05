import type { Request, Response } from 'express';
import { z } from 'zod';
import * as reviewService from '../services/review.service';

const createReviewSchema = z.object({
  reviewerName: z.string().min(1).max(50),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(1000),
});

export async function createReviewHandler(req: Request, res: Response): Promise<void> {
  const input = createReviewSchema.parse(req.body);
  const userId = req.auth?.user.id;
  const review = await reviewService.createReview({ ...input, userId });
  res.status(201).json({ review });
}

export async function listReviewsHandler(_req: Request, res: Response): Promise<void> {
  const reviews = await reviewService.listReviews();
  res.status(200).json({ reviews });
}
