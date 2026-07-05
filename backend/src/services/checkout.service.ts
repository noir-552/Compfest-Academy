import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ApiError } from '../lib/api-error';
import { computeTotals, computeDiscount } from '../lib/money';
import type { DeliveryMethod, DiscountInput, TotalsResult } from '../lib/money';
import { getOrCreateCart, pruneCart } from './cart.service';
import type { LiveCartItem } from './cart.service';
import { getOrCreateWallet } from './wallet.service';
import { now } from '../lib/clock';
import { computeSlaDeadline, toOrderDetail } from './order.service';
import type { OrderDetail } from './order.service';
import { loadVoucherForCheckout, loadPromoForCheckout, toDiscountInput } from './discount.service';

/** Either the global singleton client or an interactive transaction client. */
type Db = PrismaClient | Prisma.TransactionClient;

export interface CheckoutInput {
  addressId: string;
  deliveryMethod: DeliveryMethod;
  voucherCode?: string;
  promoCode?: string;
}

export interface DiscountLineView {
  code: string;
  amount: number;
}

export interface DiscountBreakdown {
  voucher: DiscountLineView | null;
  promo: DiscountLineView | null;
}

export interface CheckoutLineItem {
  productId: string;
  productNameSnapshot: string;
  priceSnapshot: number;
  quantity: number;
  lineTotal: number;
}

export interface CheckoutPreview {
  storeId: string;
  items: CheckoutLineItem[];
  totals: TotalsResult;
  discounts: DiscountBreakdown;
}

/**
 * Loads the buyer's cart with live pruning (delegates to cart.service so the
 * soft-delete-pruning rules live in exactly one place), and asserts it has
 * at least one live item. Accepts a `client` so it can be run either as a
 * standalone read (preview) or inside the checkout transaction (`tx`).
 */
async function loadCartOrThrow(
  buyerUserId: string,
  client: Db,
): Promise<{ cartId: string; storeId: string; liveItems: LiveCartItem[] }> {
  const cart = await getOrCreateCart(buyerUserId, client);
  const { liveItems, storeId } = await pruneCart(cart.id, cart.storeId, client);

  if (liveItems.length === 0 || !storeId) {
    throw new ApiError(400, 'CART_EMPTY', 'Your cart is empty');
  }

  return { cartId: cart.id, storeId, liveItems };
}

function buildLineItems(liveItems: LiveCartItem[]): { items: CheckoutLineItem[]; subtotal: number } {
  const items = liveItems.map((item) => ({
    productId: item.product.id,
    productNameSnapshot: item.product.name,
    priceSnapshot: item.product.price,
    quantity: item.quantity,
    lineTotal: item.product.price * item.quantity,
  }));
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  return { items, subtotal };
}

async function findOwnedAddressOrThrow(
  client: Db,
  buyerUserId: string,
  addressId: string,
): Promise<{ id: string; recipientName: string; phone: string; fullAddress: string }> {
  const address = await client.address.findFirst({ where: { id: addressId, buyerUserId } });
  if (!address) {
    throw new ApiError(404, 'ADDRESS_NOT_FOUND', 'Address not found');
  }
  return address;
}

/**
 * Resolves optional voucher/promo codes against `client` (re-validating
 * expiry/exhaustion every call — see `discount.service`'s tx-aware
 * loaders), and derives both the `computeTotals`-ready DiscountInput pair
 * and the per-code amount breakdown returned to callers. Does not mutate
 * anything (voucher quota decrement is the checkout transaction's job).
 */
async function resolveDiscounts(
  client: Db,
  subtotal: number,
  voucherCode: string | undefined,
  promoCode: string | undefined,
): Promise<{
  voucherId: string | null;
  promoId: string | null;
  voucherInput: DiscountInput | undefined;
  promoInput: DiscountInput | undefined;
  breakdown: DiscountBreakdown;
}> {
  const voucherRecord = voucherCode ? await loadVoucherForCheckout(client, voucherCode) : null;
  const promoRecord = promoCode ? await loadPromoForCheckout(client, promoCode) : null;

  const voucherInput = voucherRecord ? toDiscountInput(voucherRecord) : undefined;
  const promoInput = promoRecord ? toDiscountInput(promoRecord) : undefined;

  const { voucherAmount, promoAmount } = computeDiscount(subtotal, voucherInput, promoInput);

  return {
    voucherId: voucherRecord?.id ?? null,
    promoId: promoRecord?.id ?? null,
    voucherInput,
    promoInput,
    breakdown: {
      voucher: voucherRecord ? { code: voucherRecord.code, amount: voucherAmount } : null,
      promo: promoRecord ? { code: promoRecord.code, amount: promoAmount } : null,
    },
  };
}

/**
 * Validates the buyer's cart + address and computes totals, without writing
 * anything. Safe to call as many times as needed before checkout. Accepts
 * the same optional voucherCode/promoCode as checkout so the buyer sees the
 * exact discounted totals before committing.
 */
export async function previewCheckout(buyerUserId: string, input: CheckoutInput): Promise<CheckoutPreview> {
  const { storeId, liveItems } = await loadCartOrThrow(buyerUserId, prisma);
  await findOwnedAddressOrThrow(prisma, buyerUserId, input.addressId);

  const { items, subtotal } = buildLineItems(liveItems);
  const { voucherInput, promoInput, breakdown } = await resolveDiscounts(
    prisma,
    subtotal,
    input.voucherCode,
    input.promoCode,
  );
  const totals = computeTotals(subtotal, input.deliveryMethod, voucherInput, promoInput);

  return { storeId, items, totals, discounts: breakdown };
}

/**
 * Commits a checkout: validates cart + address, decrements stock, debits the
 * wallet, creates the order (+ items + status history + wallet transaction),
 * and clears the cart — all inside a single interactive transaction. Any
 * throw inside the callback rolls back every write, so a failure at any step
 * (insufficient stock, insufficient balance) leaves zero new rows and zero
 * balance/stock changes.
 */
export async function checkout(buyerUserId: string, input: CheckoutInput): Promise<OrderDetail> {
  return prisma.$transaction(async (tx) => {
    const { cartId, storeId, liveItems } = await loadCartOrThrow(buyerUserId, tx);
    const address = await findOwnedAddressOrThrow(tx, buyerUserId, input.addressId);

    const { items, subtotal } = buildLineItems(liveItems);
    const { voucherId, promoId, voucherInput, promoInput } = await resolveDiscounts(
      tx,
      subtotal,
      input.voucherCode,
      input.promoCode,
    );
    const totals = computeTotals(subtotal, input.deliveryMethod, voucherInput, promoInput);

    for (const item of liveItems) {
      const result = await tx.product.updateMany({
        where: { id: item.product.id, isDeleted: false, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });
      if (result.count === 0) {
        throw new ApiError(409, 'INSUFFICIENT_STOCK', `Stok ${item.product.name} tidak cukup`);
      }
    }

    if (voucherId) {
      // Conditional guard: only decrements if a unit is still available.
      // Two concurrent checkouts racing on the last unit can never both
      // succeed — the loser sees count 0 here and rolls back entirely.
      const voucherUpdate = await tx.voucher.updateMany({
        where: { id: voucherId, usageRemaining: { gt: 0 } },
        data: { usageRemaining: { decrement: 1 } },
      });
      if (voucherUpdate.count === 0) {
        throw new ApiError(409, 'DISCOUNT_EXHAUSTED', 'Discount code has no uses remaining');
      }
    }

    const wallet = await getOrCreateWallet(buyerUserId, tx);
    const debit = await tx.wallet.updateMany({
      where: { buyerUserId, balance: { gte: totals.finalTotal } },
      data: { balance: { decrement: totals.finalTotal } },
    });
    if (debit.count === 0) {
      throw new ApiError(409, 'INSUFFICIENT_BALANCE', 'Saldo wallet tidak cukup');
    }

    const slaDeadline = computeSlaDeadline(input.deliveryMethod);

    const order = await tx.order.create({
      data: {
        buyerUserId,
        storeId,
        addressId: address.id,
        voucherId,
        promoId,
        deliveryMethod: input.deliveryMethod,
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        deliveryFee: totals.deliveryFee,
        ppnAmount: totals.ppnAmount,
        finalTotal: totals.finalTotal,
        currentStatus: 'SEDANG_DIKEMAS',
        recipientNameSnapshot: address.recipientName,
        phoneSnapshot: address.phone,
        fullAddressSnapshot: address.fullAddress,
        slaDeadline,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            productNameSnapshot: item.productNameSnapshot,
            priceSnapshot: item.priceSnapshot,
            quantity: item.quantity,
          })),
        },
        statusHistory: {
          create: [{ status: 'SEDANG_DIKEMAS', changedByRole: 'BUYER', changedAt: now() }],
        },
      },
      include: {
        items: true,
        statusHistory: { orderBy: { changedAt: 'asc' } },
      },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'CHECKOUT_CHARGE',
        amount: totals.finalTotal,
        orderId: order.id,
      },
    });

    await tx.cartItem.deleteMany({ where: { cartId } });
    await tx.cart.update({ where: { id: cartId }, data: { storeId: null } });

    return toOrderDetail(order);
  });
}
