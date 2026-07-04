import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { generateToken, hashToken } from '../lib/tokens';
import { ApiError } from '../lib/api-error';
import type { RoleType } from '../lib/roles';

const BCRYPT_COST = 10;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface RegisterInput {
  username: string;
  email: string;
  phone: string;
  password: string;
  roles: RoleType[];
}

export interface PublicUser {
  id: string;
  username: string;
  email: string;
  phone: string;
  createdAt: Date;
}

interface UserRecord {
  id: string;
  username: string;
  email: string;
  phone: string;
  createdAt: Date;
}

function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    phone: user.phone,
    createdAt: user.createdAt,
  };
}

export async function register(input: RegisterInput): Promise<{ user: PublicUser; roles: RoleType[] }> {
  const existing = await prisma.user.findUnique({ where: { username: input.username } });
  if (existing) {
    throw new ApiError(409, 'USERNAME_TAKEN', 'Username is already taken');
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);

  const user = await prisma.user.create({
    data: {
      username: input.username,
      email: input.email,
      phone: input.phone,
      passwordHash,
      roles: {
        create: input.roles.map((roleType) => ({ roleType })),
      },
    },
  });

  return { user: toPublicUser(user), roles: input.roles };
}

export async function login(
  username: string,
  password: string,
): Promise<{
  token: string;
  user: PublicUser;
  roles: RoleType[];
  activeRole: RoleType | null;
}> {
  const user = await prisma.user.findUnique({ where: { username }, include: { roles: true } });
  if (!user) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid username or password');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid username or password');
  }

  const roles = user.roles.map((r) => r.roleType as RoleType);
  const activeRole: RoleType | null = roles.length === 1 ? (roles[0] as RoleType) : null;

  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash,
      activeRole,
      expiresAt,
    },
  });

  return { token, user: toPublicUser(user), roles, activeRole };
}

export async function logout(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await prisma.session.deleteMany({ where: { tokenHash } });
}

export async function setActiveRole(sessionId: string, role: RoleType): Promise<{ activeRole: RoleType }> {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Session not found');
  }

  const owned = await prisma.userRole.findUnique({
    where: { userId_roleType: { userId: session.userId, roleType: role } },
  });
  if (!owned) {
    throw new ApiError(403, 'ROLE_NOT_OWNED', 'Role is not owned by this user');
  }

  await prisma.session.update({ where: { id: sessionId }, data: { activeRole: role } });

  return { activeRole: role };
}

export async function me(session: {
  userId: string;
  activeRole: string | null;
}): Promise<{ user: PublicUser; roles: RoleType[]; activeRole: RoleType | null }> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.userId },
    include: { roles: true },
  });
  const roles = user.roles.map((r) => r.roleType as RoleType);
  return { user: toPublicUser(user), roles, activeRole: session.activeRole as RoleType | null };
}
