import express, { type Express } from 'express';
import { ApiError } from './lib/api-error';
import { errorMiddleware } from './middleware/error';
import authRoutes from './routes/auth.routes';
import reviewRoutes from './routes/review.routes';
import sellerRoutes from './routes/seller.routes';
import buyerRoutes from './routes/buyer.routes';
import catalogRoutes from './routes/catalog.routes';
import adminRoutes from './routes/admin.routes';
import discountRoutes from './routes/discount.routes';
import driverRoutes from './routes/driver.routes';

export function createApp(): Express {
  const app = express();

  // Body-size cap: rejects oversized request bodies (413) before they reach
  // JSON parsing/Zod validation — a cheap guard against memory-exhaustion
  // payloads. 100kb comfortably covers every real request shape in this API
  // (the largest inputs are review comments/product descriptions, capped
  // well under 2kb by their own Zod schemas).
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/reviews', reviewRoutes);
  app.use('/api/seller', sellerRoutes);
  app.use('/api/buyer', buyerRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/discounts', discountRoutes);
  app.use('/api/driver', driverRoutes);
  app.use('/api', catalogRoutes);

  app.use('/api', (_req, _res, next) => {
    next(new ApiError(404, 'NOT_FOUND', 'Route not found'));
  });

  app.use(errorMiddleware);

  return app;
}
