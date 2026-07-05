import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../lib/api-error';

/** Narrow shape for body-parser's PayloadTooLargeError (thrown by express.json()'s size limit). */
function isPayloadTooLargeError(err: unknown): err is Error & { type: string; status: number } {
  return (
    err instanceof Error &&
    'type' in err &&
    (err as { type?: unknown }).type === 'entity.too.large'
  );
}

export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: err.issues[0]?.message ?? 'Validation failed' } });
    return;
  }

  if (isPayloadTooLargeError(err)) {
    res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body too large' } });
    return;
  }

  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } });
}
