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
import { checkoutHandler, previewCheckoutHandler } from '../controllers/checkout.controller';
import { listOwnOrdersHandler, getOwnOrderDetailHandler } from '../controllers/order.controller';
import { getBuyerReportHandler } from '../controllers/report.controller';

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

router.post('/checkout/preview', previewCheckoutHandler);
router.post('/checkout', checkoutHandler);

router.get('/orders', listOwnOrdersHandler);
router.get('/orders/:id', getOwnOrderDetailHandler);

router.get('/report', getBuyerReportHandler);

export default router;
