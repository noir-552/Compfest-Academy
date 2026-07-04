import { prisma } from '../lib/prisma';

export interface PublicWalletTransaction {
  id: string;
  orderId: string | null;
  type: string;
  amount: number;
  createdAt: Date;
}

export interface PublicWallet {
  balance: number;
}

export interface WalletWithTransactions {
  wallet: PublicWallet;
  transactions: PublicWalletTransaction[];
}

interface WalletRecord {
  id: string;
  balance: number;
}

interface WalletTransactionRecord {
  id: string;
  orderId: string | null;
  type: string;
  amount: number;
  createdAt: Date;
}

function toPublicTransaction(tx: WalletTransactionRecord): PublicWalletTransaction {
  return {
    id: tx.id,
    orderId: tx.orderId,
    type: tx.type,
    amount: tx.amount,
    createdAt: tx.createdAt,
  };
}

export async function getOrCreateWallet(buyerUserId: string): Promise<WalletRecord> {
  return prisma.wallet.upsert({
    where: { buyerUserId },
    create: { buyerUserId, balance: 0 },
    update: {},
  });
}

export async function getWalletWithTransactions(buyerUserId: string): Promise<WalletWithTransactions> {
  const wallet = await getOrCreateWallet(buyerUserId);
  const transactions = await prisma.walletTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: 'desc' },
  });
  return {
    wallet: { balance: wallet.balance },
    transactions: transactions.map(toPublicTransaction),
  };
}

export async function topup(buyerUserId: string, amount: number): Promise<WalletWithTransactions> {
  const wallet = await getOrCreateWallet(buyerUserId);

  await prisma.$transaction([
    prisma.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: amount } } }),
    prisma.walletTransaction.create({
      data: { walletId: wallet.id, type: 'TOPUP', amount, orderId: null },
    }),
  ]);

  return getWalletWithTransactions(buyerUserId);
}
