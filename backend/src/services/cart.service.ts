import { prisma } from '../lib/prisma';
import { ApiError } from '../lib/api-error';

export interface CartItemSummary {
  product: {
    id: string;
    name: string;
    price: number;
    stock: number;
  };
  quantity: number;
  lineTotal: number;
}

export interface CartSummary {
  storeId: string | null;
  store: { id: string; storeName: string } | null;
  items: CartItemSummary[];
  subtotal: number;
}

interface CartRecord {
  id: string;
  storeId: string | null;
}

async function getOrCreateCart(buyerUserId: string): Promise<CartRecord> {
  return prisma.cart.upsert({
    where: { buyerUserId },
    create: { buyerUserId },
    update: {},
  });
}

/**
 * Deletes any cartItem rows whose product has been soft-deleted, and resets
 * the cart's storeId to null if pruning left the cart with no live items.
 * Returns the live items and the effective (post-prune) storeId, so callers
 * can make decisions (e.g. the store-conflict check) against current state
 * rather than a potentially stale `cart.storeId`.
 */
async function pruneCart(
  cartId: string,
  storeId: string | null,
): Promise<{ liveItems: Array<{ id: string; quantity: number; product: { id: string; name: string; price: number; stock: number; isDeleted: boolean } }>; storeId: string | null }> {
  const items = await prisma.cartItem.findMany({
    where: { cartId },
    include: { product: true },
  });

  const liveItems = items.filter((item) => !item.product.isDeleted);
  const staleItemIds = items.filter((item) => item.product.isDeleted).map((item) => item.id);

  if (staleItemIds.length > 0) {
    await prisma.cartItem.deleteMany({ where: { id: { in: staleItemIds } } });
  }

  let effectiveStoreId = storeId;
  if (liveItems.length === 0 && effectiveStoreId !== null) {
    effectiveStoreId = null;
    await prisma.cart.update({ where: { id: cartId }, data: { storeId: null } });
  }

  return { liveItems, storeId: effectiveStoreId };
}

/**
 * Reads a cart's items, pruning any whose product has been soft-deleted.
 * If pruning empties the cart, the cart's storeId is reset to null.
 * Returns the buyer-facing summary reflecting post-prune state.
 */
async function summarizeCart(cartId: string, storeId: string | null): Promise<CartSummary> {
  const { liveItems, storeId: effectiveStoreId } = await pruneCart(cartId, storeId);

  let store: { id: string; storeName: string } | null = null;
  if (effectiveStoreId) {
    const storeRecord = await prisma.store.findUnique({ where: { id: effectiveStoreId } });
    store = storeRecord ? { id: storeRecord.id, storeName: storeRecord.storeName } : null;
  }

  const items_ = liveItems.map((item) => ({
    product: {
      id: item.product.id,
      name: item.product.name,
      price: item.product.price,
      stock: item.product.stock,
    },
    quantity: item.quantity,
    lineTotal: item.product.price * item.quantity,
  }));

  const subtotal = items_.reduce((sum, item) => sum + item.lineTotal, 0);

  return {
    storeId: effectiveStoreId,
    store,
    items: items_,
    subtotal,
  };
}

export async function getCart(buyerUserId: string): Promise<CartSummary> {
  const cart = await getOrCreateCart(buyerUserId);
  return summarizeCart(cart.id, cart.storeId);
}

export async function addItem(
  buyerUserId: string,
  productId: string,
  quantity: number,
): Promise<CartSummary> {
  const cart = await getOrCreateCart(buyerUserId);

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || product.isDeleted) {
    throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
  }

  // Prune stale (soft-deleted-product) items before checking for a store
  // conflict, so the check reflects live cart state rather than a
  // `cart.storeId` that may be stale because no GET has run since the
  // cart's only product was soft-deleted.
  const { storeId: effectiveStoreId } = await pruneCart(cart.id, cart.storeId);

  if (effectiveStoreId !== null && effectiveStoreId !== product.storeId) {
    throw new ApiError(
      409,
      'CART_STORE_CONFLICT',
      'Your cart already has items from a different store. Clear your cart before adding items from this store.',
    );
  }

  const existingItem = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId } },
  });

  const newQuantity = (existingItem?.quantity ?? 0) + quantity;
  if (newQuantity > product.stock) {
    throw new ApiError(
      400,
      'INSUFFICIENT_STOCK',
      `Only ${product.stock} of ${product.name} left in stock`,
    );
  }

  await prisma.$transaction(async (tx) => {
    if (effectiveStoreId === null) {
      await tx.cart.update({ where: { id: cart.id }, data: { storeId: product.storeId } });
    }
    await tx.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId } },
      create: { cartId: cart.id, productId, quantity },
      update: { quantity: newQuantity },
    });
  });

  return getCart(buyerUserId);
}

export async function updateItemQuantity(
  buyerUserId: string,
  productId: string,
  quantity: number,
): Promise<CartSummary> {
  const cart = await getOrCreateCart(buyerUserId);

  const item = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId } },
    include: { product: true },
  });

  if (!item || item.product.isDeleted) {
    if (item) {
      await prisma.cartItem.delete({ where: { id: item.id } });
    }
    throw new ApiError(404, 'CART_ITEM_NOT_FOUND', 'Item not found in cart');
  }

  if (quantity > item.product.stock) {
    throw new ApiError(
      400,
      'INSUFFICIENT_STOCK',
      `Only ${item.product.stock} of ${item.product.name} left in stock`,
    );
  }

  await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });

  return getCart(buyerUserId);
}

export async function removeItem(buyerUserId: string, productId: string): Promise<CartSummary> {
  const cart = await getOrCreateCart(buyerUserId);

  const item = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId } },
  });
  if (!item) {
    throw new ApiError(404, 'CART_ITEM_NOT_FOUND', 'Item not found in cart');
  }

  await prisma.cartItem.delete({ where: { id: item.id } });

  const remaining = await prisma.cartItem.count({ where: { cartId: cart.id } });
  if (remaining === 0) {
    await prisma.cart.update({ where: { id: cart.id }, data: { storeId: null } });
  }

  return getCart(buyerUserId);
}

export async function clearCart(buyerUserId: string): Promise<CartSummary> {
  const cart = await getOrCreateCart(buyerUserId);

  await prisma.$transaction([
    prisma.cartItem.deleteMany({ where: { cartId: cart.id } }),
    prisma.cart.update({ where: { id: cart.id }, data: { storeId: null } }),
  ]);

  return getCart(buyerUserId);
}
