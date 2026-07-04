import { Router } from 'express';
import { requireAuth, requireActiveRole } from '../middleware/auth';
import { getStoreHandler, createStoreHandler, updateStoreHandler } from '../controllers/store.controller';
import {
  listProductsHandler,
  createProductHandler,
  updateProductHandler,
  deleteProductHandler,
} from '../controllers/product.controller';

const router = Router();

router.use(requireAuth, requireActiveRole('SELLER'));

router.get('/store', getStoreHandler);
router.post('/store', createStoreHandler);
router.put('/store', updateStoreHandler);

router.get('/products', listProductsHandler);
router.post('/products', createProductHandler);
router.put('/products/:id', updateProductHandler);
router.delete('/products/:id', deleteProductHandler);

export default router;
