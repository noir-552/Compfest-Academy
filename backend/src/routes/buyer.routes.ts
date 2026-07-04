import { Router } from 'express';
import { requireAuth, requireActiveRole } from '../middleware/auth';
import { getWalletHandler, topupHandler } from '../controllers/wallet.controller';
import {
  listAddressesHandler,
  createAddressHandler,
  updateAddressHandler,
  deleteAddressHandler,
} from '../controllers/address.controller';

const router = Router();

router.use(requireAuth, requireActiveRole('BUYER'));

router.get('/wallet', getWalletHandler);
router.post('/wallet/topup', topupHandler);

router.get('/addresses', listAddressesHandler);
router.post('/addresses', createAddressHandler);
router.put('/addresses/:id', updateAddressHandler);
router.delete('/addresses/:id', deleteAddressHandler);

export default router;
