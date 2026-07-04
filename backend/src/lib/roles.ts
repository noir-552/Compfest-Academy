export const ALL_ROLES = ['ADMIN', 'SELLER', 'BUYER', 'DRIVER'] as const;
export const REGISTERABLE_ROLES = ['BUYER', 'SELLER', 'DRIVER'] as const;

export type RoleType = (typeof ALL_ROLES)[number];
