import { Router } from 'express';
import { requireAuth, requireActiveRole } from '../middleware/auth';
import {
  listAvailableJobsHandler,
  getMyJobsHandler,
  getJobDetailHandler,
  takeJobHandler,
  completeJobHandler,
  getEarningsHandler,
} from '../controllers/driver.controller';

const router = Router();

router.use(requireAuth, requireActiveRole('DRIVER'));

// Order matters: /jobs/available and /jobs/mine must be registered before
// the /jobs/:id catch-all below.
router.get('/jobs/available', listAvailableJobsHandler);
router.get('/jobs/mine', getMyJobsHandler);
router.get('/jobs/:id', getJobDetailHandler);
router.post('/jobs/:id/take', takeJobHandler);
router.post('/jobs/:id/complete', completeJobHandler);

router.get('/earnings', getEarningsHandler);

export default router;
