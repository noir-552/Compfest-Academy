import express, { type Express } from 'express';
import { ApiError } from './lib/api-error';
import { errorMiddleware } from './middleware/error';
import authRoutes from './routes/auth.routes';

export function createApp(): Express {
  const app = express();

  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/api/auth', authRoutes);

  app.use('/api', (_req, _res, next) => {
    next(new ApiError(404, 'NOT_FOUND', 'Route not found'));
  });

  app.use(errorMiddleware);

  return app;
}
