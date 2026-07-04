import { Router } from 'express';
import { requireAuth, requireActiveRole } from '../middleware/auth';
import {
  createVoucherHandler,
  createPromoHandler,
  listVouchersHandler,
  getVoucherHandler,
  listPromosHandler,
  getPromoHandler,
} from '../controllers/discount.controller';

const router = Router();

router.use(requireAuth, requireActiveRole('ADMIN'));

router.post('/vouchers', createVoucherHandler);
router.get('/vouchers', listVouchersHandler);
router.get('/vouchers/:id', getVoucherHandler);

router.post('/promos', createPromoHandler);
router.get('/promos', listPromosHandler);
router.get('/promos/:id', getPromoHandler);

export default router;
