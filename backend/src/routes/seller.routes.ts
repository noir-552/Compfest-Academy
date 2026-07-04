import { Router } from 'express';
import { requireAuth, requireActiveRole } from '../middleware/auth';
import { getStoreHandler, createStoreHandler, updateStoreHandler } from '../controllers/store.controller';
import {
  listProductsHandler,
  createProductHandler,
  updateProductHandler,
  deleteProductHandler,
} from '../controllers/product.controller';
import { listIncomingOrdersHandler, processOrderHandler } from '../controllers/order.controller';
import { getSellerReportHandler } from '../controllers/report.controller';

const router = Router();

router.use(requireAuth, requireActiveRole('SELLER'));

router.get('/store', getStoreHandler);
router.post('/store', createStoreHandler);
router.put('/store', updateStoreHandler);

router.get('/products', listProductsHandler);
router.post('/products', createProductHandler);
router.put('/products/:id', updateProductHandler);
router.delete('/products/:id', deleteProductHandler);

router.get('/orders', listIncomingOrdersHandler);
router.post('/orders/:id/process', processOrderHandler);

router.get('/report', getSellerReportHandler);

export default router;
