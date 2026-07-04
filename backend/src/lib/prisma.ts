import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const PRAGMA_JOURNAL_MODE_WAL = 'PRAGMA journal_mode=WAL;';
const PRAGMA_BUSY_TIMEOUT = 'PRAGMA busy_timeout=5000;';

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? 'file:./dev.db' });

export const prisma = new PrismaClient({ adapter });

// Queued as the first operations on the singleton connection; any query made
// through this module's `prisma` export is necessarily submitted after these
// two (a consumer must finish importing this module, and its top-level code,
// before it can obtain the `prisma` reference to query with).
void prisma.$queryRawUnsafe(PRAGMA_JOURNAL_MODE_WAL);
void prisma.$queryRawUnsafe(PRAGMA_BUSY_TIMEOUT);
