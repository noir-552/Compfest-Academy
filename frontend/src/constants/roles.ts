import type { RoleType } from '../api/auth';

export const DASHBOARD_PATH: Record<RoleType, string> = {
  ADMIN: '/dashboard/admin',
  SELLER: '/dashboard/seller',
  BUYER: '/dashboard/buyer',
  DRIVER: '/dashboard/driver',
};

export const ROLE_LABEL: Record<RoleType, string> = {
  ADMIN: 'Admin',
  SELLER: 'Penjual',
  BUYER: 'Pembeli',
  DRIVER: 'Kurir',
};
