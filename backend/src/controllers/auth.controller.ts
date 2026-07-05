import type { Request, Response } from 'express';
import { z } from 'zod';
import * as authService from '../services/auth.service';
import { ApiError } from '../lib/api-error';
import { ALL_ROLES, REGISTERABLE_ROLES } from '../lib/roles';
import { extractBearerToken } from '../middleware/auth';
import { assertLoginNotRateLimited, recordLoginFailure, recordLoginSuccess } from '../middleware/rate-limit';

const registerSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores'),
  email: z.string().email(),
  phone: z.string().regex(/^\d{8,15}$/, 'Phone must be 8-15 digits'),
  password: z.string().min(8),
  roles: z
    .array(z.enum(REGISTERABLE_ROLES))
    .min(1)
    .refine((roles) => new Set(roles).size === roles.length, {
      message: 'roles must not contain duplicates',
    }),
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const activeRoleSchema = z.object({
  role: z.enum(ALL_ROLES),
});

export async function registerHandler(req: Request, res: Response): Promise<void> {
  const input = registerSchema.parse(req.body);
  const result = await authService.register(input);
  res.status(201).json(result);
}

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const input = loginSchema.parse(req.body);
  assertLoginNotRateLimited(req);
  try {
    const result = await authService.login(input.username, input.password);
    recordLoginSuccess(req);
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof ApiError && err.code === 'INVALID_CREDENTIALS') {
      recordLoginFailure(req);
    }
    throw err;
  }
}

export async function logoutHandler(req: Request, res: Response): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Missing bearer token');
  }
  await authService.logout(token);
  res.status(200).json({});
}

export async function meHandler(req: Request, res: Response): Promise<void> {
  if (!req.auth) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Not authenticated');
  }
  const result = await authService.me(req.auth.session);
  res.status(200).json(result);
}

export async function setActiveRoleHandler(req: Request, res: Response): Promise<void> {
  if (!req.auth) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Not authenticated');
  }
  const input = activeRoleSchema.parse(req.body);
  const result = await authService.setActiveRole(req.auth.session.id, input.role);
  res.status(200).json(result);
}
