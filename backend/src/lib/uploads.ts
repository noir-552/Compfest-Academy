import fs from 'node:fs';
import path from 'node:path';

/**
 * Directory where uploaded product photos are written/served from.
 * Configurable via UPLOADS_DIR (used in docker-compose to point at the
 * persisted backend-data volume); defaults to ./uploads relative to the
 * backend project root (process.cwd() when running `npm run dev`/tests, or
 * /app inside the container).
 */
export const UPLOADS_DIR = path.resolve(process.cwd(), process.env.UPLOADS_DIR ?? './uploads');

/** Ensures the uploads directory exists. Called once at startup. */
export function ensureUploadsDir(): void {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
