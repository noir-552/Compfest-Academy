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

/** Role tint chip classes (DESIGN.md role tints: buyer=teal, seller=indigo, driver=coral, admin=ink). */
export const ROLE_CHIP_CLASS: Record<RoleType, string> = {
  BUYER: 'bg-role-buyer/10 text-role-buyer',
  SELLER: 'bg-role-seller/10 text-role-seller',
  DRIVER: 'bg-role-driver/10 text-role-driver',
  ADMIN: 'bg-role-admin/10 text-role-admin',
};
