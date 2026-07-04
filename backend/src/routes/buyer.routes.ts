import { Router } from 'express';
import { requireAuth, requireActiveRole } from '../middleware/auth';
import { getWalletHandler, topupHandler } from '../controllers/wallet.controller';
import {
  listAddressesHandler,
  createAddressHandler,
  updateAddressHandler,
  deleteAddressHandler,
} from '../controllers/address.controller';
import {
  getCartHandler,
  addItemHandler,
  updateItemHandler,
  removeItemHandler,
  clearCartHandler,
} from '../controllers/cart.controller';

const router = Router();

router.use(requireAuth, requireActiveRole('BUYER'));

router.get('/wallet', getWalletHandler);
router.post('/wallet/topup', topupHandler);

router.get('/addresses', listAddressesHandler);
router.post('/addresses', createAddressHandler);
router.put('/addresses/:id', updateAddressHandler);
router.delete('/addresses/:id', deleteAddressHandler);

router.get('/cart', getCartHandler);
router.post('/cart/items', addItemHandler);
router.put('/cart/items/:productId', updateItemHandler);
router.delete('/cart/items/:productId', removeItemHandler);
router.delete('/cart', clearCartHandler);

export default router;
