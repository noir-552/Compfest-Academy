import { prisma } from '../lib/prisma';

export interface CreateReviewInput {
  reviewerName: string;
  rating: number;
  comment: string;
  userId?: string;
}

export interface PublicReview {
  id: string;
  reviewerName: string;
  rating: number;
  comment: string;
  createdAt: Date;
}

function toPublicReview(review: {
  id: string;
  reviewerName: string;
  rating: number;
  comment: string;
  createdAt: Date;
}): PublicReview {
  return {
    id: review.id,
    reviewerName: review.reviewerName,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
  };
}

export async function createReview(input: CreateReviewInput): Promise<PublicReview> {
  const review = await prisma.appReview.create({
    data: {
      reviewerName: input.reviewerName,
      rating: input.rating,
      comment: input.comment,
      userId: input.userId ?? null,
    },
  });

  return toPublicReview(review);
}

export async function listReviews(): Promise<PublicReview[]> {
  const reviews = await prisma.appReview.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return reviews.map(toPublicReview);
}
