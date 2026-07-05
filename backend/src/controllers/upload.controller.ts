import type { Request, Response } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ApiError } from '../lib/api-error';
import { UPLOADS_DIR } from '../lib/uploads';

const ALLOWED_MIMETYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * multer instance for the single `image` field: memory storage (the file
 * never touches disk until it passes validation) capped at 2MB. Mounted
 * ahead of the handler in the route; multer's own errors (oversize, etc.)
 * are forwarded to `next()` and mapped to the error envelope centrally in
 * middleware/error.ts.
 */
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
}).single('image');

interface SniffedType {
  ext: string;
}

/**
 * Sniffs the real file type from its magic bytes. Defense in depth against
 * the client-declared mimetype/filename, both of which are attacker
 * controlled — a ".png" that's actually a script must not be trusted just
 * because multer reports mimetype: "image/png". Returns null when the
 * buffer doesn't match any allowed image signature.
 */
function sniffImageType(buffer: Buffer): SniffedType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: 'jpg' };
  }
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return { ext: 'png' };
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { ext: 'webp' };
  }
  return null;
}

export async function uploadProductImageHandler(req: Request, res: Response): Promise<void> {
  if (!req.auth) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Not authenticated');
  }

  const file = req.file;
  if (!file) {
    throw new ApiError(400, 'IMAGE_REQUIRED', 'An image file is required');
  }

  if (!ALLOWED_MIMETYPES.has(file.mimetype)) {
    throw new ApiError(400, 'INVALID_IMAGE', 'File must be a JPEG, PNG, or WebP image');
  }

  const sniffed = sniffImageType(file.buffer);
  if (!sniffed) {
    throw new ApiError(400, 'INVALID_IMAGE', 'File content does not match a supported image type');
  }

  const filename = `${randomUUID()}.${sniffed.ext}`;
  await fs.writeFile(path.join(UPLOADS_DIR, filename), file.buffer);

  res.status(201).json({ url: `/api/uploads/${filename}` });
}
