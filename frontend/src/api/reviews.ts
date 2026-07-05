import { apiFetch } from './client';

export interface Review {
  id: string;
  reviewerName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface CreateReviewInput {
  reviewerName: string;
  rating: number;
  comment: string;
}

export function listReviews(): Promise<{ reviews: Review[] }> {
  return apiFetch<{ reviews: Review[] }>('/reviews');
}

export function createReview(input: CreateReviewInput): Promise<{ review: Review }> {
  return apiFetch<{ review: Review }>('/reviews', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
