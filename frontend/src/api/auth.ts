import { apiFetch } from './client';

export const ALL_ROLES = ['ADMIN', 'SELLER', 'BUYER', 'DRIVER'] as const;
export type RoleType = (typeof ALL_ROLES)[number];

export type RegisterableRole = Exclude<RoleType, 'ADMIN'>;

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  phone: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
  roles: RoleType[];
  activeRole: RoleType | null;
}

export interface MeResponse {
  user: AuthUser;
  roles: RoleType[];
  activeRole: RoleType | null;
}

export interface RegisterInput {
  username: string;
  email: string;
  phone: string;
  password: string;
  roles: RegisterableRole[];
}

export interface RegisterResponse {
  user: AuthUser;
  roles: RoleType[];
}

export function register(input: RegisterInput): Promise<RegisterResponse> {
  return apiFetch<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function login(username: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function logout(): Promise<Record<string, never>> {
  return apiFetch<Record<string, never>>('/auth/logout', { method: 'POST' });
}

export function me(): Promise<MeResponse> {
  return apiFetch<MeResponse>('/auth/me');
}

export function setActiveRoleRequest(role: RoleType): Promise<{ activeRole: RoleType }> {
  return apiFetch<{ activeRole: RoleType }>('/auth/active-role', {
    method: 'POST',
    body: JSON.stringify({ role }),
  });
}
