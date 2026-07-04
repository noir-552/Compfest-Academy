import type { NextFunction, Request, Response } from 'express';
import type { Session, User, UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { hashToken } from '../lib/tokens';
import { ApiError } from '../lib/api-error';
import type { RoleType } from '../lib/roles';

export interface AuthContext {
  user: User & { roles: UserRole[] };
  session: Session;
  activeRole: RoleType | null;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export function extractBearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return undefined;
  }
  return header.slice('Bearer '.length);
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) {
    next(new ApiError(401, 'UNAUTHENTICATED', 'Missing bearer token'));
    return;
  }

  const tokenHash = hashToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: { include: { roles: true } } },
  });

  if (!session || session.expiresAt.getTime() < Date.now()) {
    next(new ApiError(401, 'UNAUTHENTICATED', 'Session expired or not found'));
    return;
  }

  const { user, ...session_ } = session;
  req.auth = {
    user,
    session: session_,
    activeRole: session_.activeRole as RoleType | null,
  };
  next();
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) {
    next();
    return;
  }

  const tokenHash = hashToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: { include: { roles: true } } },
  });

  if (!session || session.expiresAt.getTime() < Date.now()) {
    next();
    return;
  }

  const { user, ...session_ } = session;
  req.auth = {
    user,
    session: session_,
    activeRole: session_.activeRole as RoleType | null,
  };
  next();
}

export function requireActiveRole(...roles: RoleType[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const activeRole = req.auth?.activeRole ?? null;
    if (activeRole === null) {
      next(new ApiError(403, 'NO_ACTIVE_ROLE', 'No active role set'));
      return;
    }
    if (!roles.includes(activeRole)) {
      next(new ApiError(403, 'WRONG_ROLE', 'Active role not permitted for this action'));
      return;
    }
    next();
  };
}
