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
import {
  simulateNextDayHandler,
  getOverdueHandler,
  getOverviewHandler,
  listUsersHandler,
  listStoresHandler,
  listProductsHandler,
  listOrdersHandler,
  listDeliveryJobsHandler,
} from '../controllers/admin.controller';

const router = Router();

router.use(requireAuth, requireActiveRole('ADMIN'));

router.post('/vouchers', createVoucherHandler);
router.get('/vouchers', listVouchersHandler);
router.get('/vouchers/:id', getVoucherHandler);

router.post('/promos', createPromoHandler);
router.get('/promos', listPromosHandler);
router.get('/promos/:id', getPromoHandler);

router.post('/simulate-next-day', simulateNextDayHandler);
router.get('/overdue', getOverdueHandler);

router.get('/overview', getOverviewHandler);
router.get('/users', listUsersHandler);
router.get('/stores', listStoresHandler);
router.get('/products', listProductsHandler);
router.get('/orders', listOrdersHandler);
router.get('/delivery-jobs', listDeliveryJobsHandler);

export default router;
