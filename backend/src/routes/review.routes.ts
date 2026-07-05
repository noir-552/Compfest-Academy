import { Router } from 'express';
import { createReviewHandler, listReviewsHandler } from '../controllers/review.controller';
import { optionalAuth } from '../middleware/auth';

const router = Router();

router.post('/', optionalAuth, createReviewHandler);
router.get('/', listReviewsHandler);

export default router;
