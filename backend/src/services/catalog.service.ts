import { prisma } from '../lib/prisma';
import { ApiError } from '../lib/api-error';

// Public, unauthenticated catalog reads. All queries here MUST exclude
// isDeleted products — this module is the only write path into the public
// storefront, so the soft-delete filter belongs here, not in the controller.

export interface PublicStoreRef {
  id: string;
  storeName: string;
}

export interface PublicProductListItem {
  id: string;
  name: string;
  price: number;
  stock: number;
  imageUrl: string | null;
  store: PublicStoreRef;
}

export interface PublicProductDetail extends Omit<PublicProductListItem, 'store'> {
  description: string | null;
  store: PublicStoreRef & { description: string | null };
}

export interface PublicStoreProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
  imageUrl: string | null;
}

export interface PublicStoreDetail {
  id: string;
  storeName: string;
  description: string | null;
  products: PublicStoreProduct[];
}

export interface ListPublicProductsParams {
  search?: string;
  storeId?: string;
}

interface ProductWithStore {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  imageUrl: string | null;
  store: { id: string; storeName: string; description: string | null };
}

function toListItem(product: ProductWithStore): PublicProductListItem {
  return {
    id: product.id,
    name: product.name,
    price: product.price,
    stock: product.stock,
    imageUrl: product.imageUrl,
    store: { id: product.store.id, storeName: product.store.storeName },
  };
}

function toDetail(product: ProductWithStore): PublicProductDetail {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    stock: product.stock,
    imageUrl: product.imageUrl,
    store: {
      id: product.store.id,
      storeName: product.store.storeName,
      description: product.store.description,
    },
  };
}

/**
 * `search` matches product name case-insensitively. SQLite (this project's
 * datasource) does not support Prisma's `mode: 'insensitive'` on `contains`
 * for its default collation, so a DB-level `contains` filter here would be
 * case-sensitive. Since the catalog is small, we instead fetch the
 * (already-narrow, isDeleted/storeId-filtered) rows from the DB and apply
 * the case-insensitive substring match in JS. This is correct at this data
 * scale; a larger catalog would want a citext-like column or FTS index.
 */
export async function listPublicProducts(params: ListPublicProductsParams): Promise<PublicProductListItem[]> {
  const products = await prisma.product.findMany({
    where: {
      isDeleted: false,
      ...(params.storeId ? { storeId: params.storeId } : {}),
    },
    include: { store: true },
    orderBy: { createdAt: 'desc' },
  });

  const search = params.search?.trim().toLowerCase();
  const filtered = search ? products.filter((p) => p.name.toLowerCase().includes(search)) : products;

  return filtered.map(toListItem);
}

export async function getPublicProductById(id: string): Promise<PublicProductDetail> {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { store: true },
  });

  if (!product || product.isDeleted) {
    throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
  }

  return toDetail(product);
}

export async function getPublicStoreById(id: string): Promise<PublicStoreDetail> {
  const store = await prisma.store.findUnique({
    where: { id },
    include: {
      products: {
        where: { isDeleted: false },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!store) {
    throw new ApiError(404, 'STORE_NOT_FOUND', 'Store not found');
  }

  return {
    id: store.id,
    storeName: store.storeName,
    description: store.description,
    products: store.products.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      stock: p.stock,
      imageUrl: p.imageUrl,
    })),
  };
}
