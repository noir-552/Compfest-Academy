import { Router } from 'express';
import { requireAuth, requireActiveRole } from '../middleware/auth';
import { validateDiscountHandler } from '../controllers/discount.controller';

const router = Router();

router.use(requireAuth, requireActiveRole('BUYER'));

router.post('/validate', validateDiscountHandler);

export default router;
