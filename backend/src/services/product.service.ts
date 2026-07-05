import { prisma } from '../lib/prisma';
import { ApiError } from '../lib/api-error';
import { getOwnStoreOrThrow } from './store.service';

export interface ProductInput {
  name: string;
  description?: string;
  price: number;
  stock: number;
  imageUrl?: string | null;
}

export interface PublicProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  imageUrl: string | null;
  isDeleted: boolean;
  createdAt: Date;
}

interface ProductRecord {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  imageUrl: string | null;
  isDeleted: boolean;
  createdAt: Date;
}

function toPublicProduct(product: ProductRecord): PublicProduct {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    stock: product.stock,
    imageUrl: product.imageUrl,
    isDeleted: product.isDeleted,
    createdAt: product.createdAt,
  };
}

export async function listOwnProducts(sellerUserId: string): Promise<PublicProduct[]> {
  const store = await getOwnStoreOrThrow(sellerUserId);
  const products = await prisma.product.findMany({
    where: { storeId: store.id, isDeleted: false },
    orderBy: { createdAt: 'desc' },
  });
  return products.map(toPublicProduct);
}

export async function createProduct(sellerUserId: string, input: ProductInput): Promise<PublicProduct> {
  const store = await getOwnStoreOrThrow(sellerUserId);
  const product = await prisma.product.create({
    data: {
      storeId: store.id,
      name: input.name,
      description: input.description ?? null,
      price: input.price,
      stock: input.stock,
      imageUrl: input.imageUrl ?? null,
    },
  });
  return toPublicProduct(product);
}

async function getOwnedProductOrThrow(
  sellerUserId: string,
  productId: string,
): Promise<{ id: string; storeId: string }> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { store: true },
  });
  if (!product) {
    throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
  }
  if (product.store.sellerUserId !== sellerUserId) {
    throw new ApiError(403, 'NOT_OWNER', 'Product does not belong to this seller');
  }
  if (product.isDeleted) {
    throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
  }
  return product;
}

export async function updateProduct(
  sellerUserId: string,
  productId: string,
  input: ProductInput,
): Promise<PublicProduct> {
  await getOwnedProductOrThrow(sellerUserId, productId);

  const product = await prisma.product.update({
    where: { id: productId },
    data: {
      name: input.name,
      description: input.description ?? null,
      price: input.price,
      stock: input.stock,
      imageUrl: input.imageUrl ?? null,
    },
  });
  return toPublicProduct(product);
}

export async function deleteProduct(sellerUserId: string, productId: string): Promise<void> {
  await getOwnedProductOrThrow(sellerUserId, productId);

  await prisma.product.update({
    where: { id: productId },
    data: { isDeleted: true },
  });
}
