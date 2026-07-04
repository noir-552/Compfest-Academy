import { Router } from 'express';
import {
  registerHandler,
  loginHandler,
  logoutHandler,
  meHandler,
  setActiveRoleHandler,
} from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/register', registerHandler);
router.post('/login', loginHandler);
router.post('/logout', requireAuth, logoutHandler);
router.get('/me', requireAuth, meHandler);
router.post('/active-role', requireAuth, setActiveRoleHandler);

export default router;
