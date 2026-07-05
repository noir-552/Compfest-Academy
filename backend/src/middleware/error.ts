import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import multer from 'multer';
import { ApiError } from '../lib/api-error';

/** Narrow shape for body-parser's PayloadTooLargeError (thrown by express.json()'s size limit). */
function isPayloadTooLargeError(err: unknown): err is Error & { type: string; status: number } {
  return (
    err instanceof Error &&
    'type' in err &&
    (err as { type?: unknown }).type === 'entity.too.large'
  );
}

/**
 * Narrow shape for the http-errors instance the `send` module (which backs
 * express.static) emits when `fallthrough: false` and the requested file
 * doesn't exist — has a numeric `.status`/`.statusCode` but is not one of
 * our own ApiError/ZodError/MulterError types.
 */
function isStaticNotFoundError(err: unknown): err is Error & { status: number } {
  return err instanceof Error && 'status' in err && (err as { status?: unknown }).status === 404;
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

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: { code: 'IMAGE_TOO_LARGE', message: 'Image exceeds the 2MB size limit' } });
      return;
    }
    res.status(400).json({ error: { code: 'INVALID_IMAGE', message: err.message } });
    return;
  }

  if (isPayloadTooLargeError(err)) {
    res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body too large' } });
    return;
  }

  if (isStaticNotFoundError(err)) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'File not found' } });
    return;
  }

  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } });
}
