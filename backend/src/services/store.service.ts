import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../lib/api-error';

export interface CreateStoreInput {
  storeName: string;
  description?: string;
}

export interface UpdateStoreInput {
  storeName: string;
  description?: string;
}

export interface PublicStore {
  id: string;
  storeName: string;
  description: string | null;
  createdAt: Date;
}

interface StoreRecord {
  id: string;
  storeName: string;
  description: string | null;
  createdAt: Date;
}

function toPublicStore(store: StoreRecord): PublicStore {
  return {
    id: store.id,
    storeName: store.storeName,
    description: store.description,
    createdAt: store.createdAt,
  };
}

export async function getOwnStore(sellerUserId: string): Promise<PublicStore | null> {
  const store = await prisma.store.findUnique({ where: { sellerUserId } });
  return store ? toPublicStore(store) : null;
}

export async function getOwnStoreOrThrow(sellerUserId: string): Promise<PublicStore> {
  const store = await getOwnStore(sellerUserId);
  if (!store) {
    throw new ApiError(404, 'STORE_NOT_FOUND', 'Store not found');
  }
  return store;
}

export async function createStore(sellerUserId: string, input: CreateStoreInput): Promise<PublicStore> {
  const existing = await prisma.store.findUnique({ where: { sellerUserId } });
  if (existing) {
    throw new ApiError(409, 'STORE_ALREADY_EXISTS', 'Seller already has a store');
  }

  try {
    const store = await prisma.store.create({
      data: {
        sellerUserId,
        storeName: input.storeName,
        description: input.description ?? null,
      },
    });
    return toPublicStore(store);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ApiError(409, 'STORE_NAME_TAKEN', 'Store name is already taken');
    }
    throw err;
  }
}

export async function updateStore(sellerUserId: string, input: UpdateStoreInput): Promise<PublicStore> {
  const existing = await prisma.store.findUnique({ where: { sellerUserId } });
  if (!existing) {
    throw new ApiError(404, 'STORE_NOT_FOUND', 'Store not found');
  }

  try {
    const store = await prisma.store.update({
      where: { sellerUserId },
      data: {
        storeName: input.storeName,
        description: input.description ?? null,
      },
    });
    return toPublicStore(store);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ApiError(409, 'STORE_NAME_TAKEN', 'Store name is already taken');
    }
    throw err;
  }
}
