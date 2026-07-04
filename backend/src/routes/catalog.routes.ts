import { Router } from 'express';
import { listProductsHandler, getProductHandler, getStoreHandler } from '../controllers/catalog.controller';

// Public catalog routes — mounted at the `/api` root in app.ts (no auth
// middleware). Guests and authenticated users alike can browse products and
// stores; nothing here reads req.auth.
const router = Router();

router.get('/products', listProductsHandler);
router.get('/products/:id', getProductHandler);
router.get('/stores/:id', getStoreHandler);

export default router;
