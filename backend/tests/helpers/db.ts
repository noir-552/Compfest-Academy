import { execSync } from 'node:child_process';
import path from 'node:path';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '../../src/lib/prisma';
import type { RoleType } from '../../src/lib/roles';

const BACKEND_ROOT = path.resolve(__dirname, '../..');

let migrated = false;

function ensureMigrated(): void {
  if (migrated) return;
  migrated = true;
  execSync('npx prisma migrate deploy', {
    cwd: BACKEND_ROOT,
    env: process.env,
    stdio: 'inherit',
  });
}

ensureMigrated();

export async function resetDb(): Promise<void> {
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.deliveryJob.deleteMany();
  await prisma.order.deleteMany();
  await prisma.voucher.deleteMany();
  await prisma.promo.deleteMany();
  await prisma.product.deleteMany();
  await prisma.store.deleteMany();
  await prisma.walletTransaction.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.address.deleteMany();
  await prisma.session.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.appReview.deleteMany();
  await prisma.user.deleteMany();
}

let userCounter = 0;

export interface RegisterAndLoginOptions {
  roles: RoleType[];
  username?: string;
  email?: string;
  phone?: string;
  password?: string;
  /**
   * Active role to set after login. Required when registering with more
   * than one role, since login only auto-activates a role for single-role
   * users; without this, requests would fail with 403 NO_ACTIVE_ROLE.
   */
  activeRole?: RoleType;
}

export interface RegisterAndLoginResult {
  token: string;
  username: string;
  password: string;
}

export async function registerAndLogin(
  app: Express,
  opts: RegisterAndLoginOptions,
): Promise<RegisterAndLoginResult> {
  userCounter += 1;
  const username = opts.username ?? `testuser${userCounter}`;
  const email = opts.email ?? `${username}@example.com`;
  const phone = opts.phone ?? '081234567890';
  const password = opts.password ?? 'password123';

  const registerRes = await request(app).post('/api/auth/register').send({
    username,
    email,
    phone,
    password,
    roles: opts.roles,
  });

  if (registerRes.status !== 201) {
    throw new Error(`registerAndLogin: register failed with ${registerRes.status}: ${JSON.stringify(registerRes.body)}`);
  }

  const loginRes = await request(app).post('/api/auth/login').send({ username, password });

  if (loginRes.status !== 200) {
    throw new Error(`registerAndLogin: login failed with ${loginRes.status}: body=${JSON.stringify(loginRes.body)} text=${JSON.stringify(loginRes.text)} headers=${JSON.stringify(loginRes.headers)}`);
  }

  const token = loginRes.body.token as string;

  if (opts.activeRole) {
    const activeRoleRes = await request(app)
      .post('/api/auth/active-role')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: opts.activeRole });

    if (activeRoleRes.status !== 200) {
      throw new Error(
        `registerAndLogin: setting activeRole failed with ${activeRoleRes.status}: ${JSON.stringify(activeRoleRes.body)}`,
      );
    }
  }

  return { token, username, password };
}

/**
 * Registers + logs in a user, then grants ADMIN directly via prisma (the
 * public /api/auth/register endpoint only accepts REGISTERABLE_ROLES —
 * BUYER/SELLER/DRIVER — so ADMIN can never be requested through it) and
 * activates that role. Mirrors how `create-admin` provisions real admins.
 */
export async function registerAndLoginAdmin(
  app: Express,
  opts: Omit<RegisterAndLoginOptions, 'roles' | 'activeRole'> = {},
): Promise<RegisterAndLoginResult> {
  const { token, username, password } = await registerAndLogin(app, { ...opts, roles: ['BUYER'] });

  const user = await prisma.user.findUniqueOrThrow({ where: { username } });
  await prisma.userRole.create({ data: { userId: user.id, roleType: 'ADMIN' } });

  const activeRoleRes = await request(app)
    .post('/api/auth/active-role')
    .set('Authorization', `Bearer ${token}`)
    .send({ role: 'ADMIN' });

  if (activeRoleRes.status !== 200) {
    throw new Error(
      `registerAndLoginAdmin: setting activeRole failed with ${activeRoleRes.status}: ${JSON.stringify(activeRoleRes.body)}`,
    );
  }

  return { token, username, password };
}
