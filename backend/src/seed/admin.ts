import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';

const BCRYPT_COST = 10;

/**
 * Idempotent admin-user creation script: `npm run create-admin` (optionally
 * `-- --username=x --password=y --email=z --phone=w`), or via env vars
 * ADMIN_USERNAME / ADMIN_PASSWORD / ADMIN_EMAIL / ADMIN_PHONE. CLI args win
 * over env vars, which win over the admin/admin123 defaults. Registration
 * can't grant the ADMIN role (see lib/roles.ts REGISTERABLE_ROLES), so this
 * script is the only way to provision one. Reuses the prisma singleton
 * (Prisma 7 driver adapter) rather than constructing a new PrismaClient.
 */
function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  for (const arg of process.argv.slice(2)) {
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (match) {
      const [, key, value] = match;
      args[key as string] = value as string;
    }
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const username = args.username ?? process.env.ADMIN_USERNAME ?? 'admin';
  const password = args.password ?? process.env.ADMIN_PASSWORD ?? 'admin123';
  const email = args.email ?? process.env.ADMIN_EMAIL ?? 'admin@seapedia.local';
  const phone = args.phone ?? process.env.ADMIN_PHONE ?? '080000000000';

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  const user = await prisma.user.upsert({
    where: { username },
    create: {
      username,
      email,
      phone,
      passwordHash,
      roles: { create: [{ roleType: 'ADMIN' }] },
    },
    update: {
      passwordHash,
      email,
      phone,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleType: { userId: user.id, roleType: 'ADMIN' } },
    create: { userId: user.id, roleType: 'ADMIN' },
    update: {},
  });

  console.log(`Admin user ready: username=${username}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
