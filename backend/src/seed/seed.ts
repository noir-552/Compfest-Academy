import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import type { RoleType } from '../lib/roles';

/**
 * Full demo-data seed for graders/evaluators: `npm run seed`. Idempotent —
 * every write is an upsert (or a guarded create) keyed on a natural unique
 * field (username, storeName, voucher/promo code), so running this script
 * twice in a row never duplicates rows or throws. Reuses the shared prisma
 * singleton (Prisma 7 driver adapter) rather than constructing a new
 * PrismaClient — see `src/seed/admin.ts` for the same pattern.
 *
 * Money/date rules are NOT re-derived here: product prices, delivery fees,
 * discount math, and SLA deadlines are all computed by the app itself at
 * checkout time (see `src/lib/money.ts`). This script only seeds the
 * base catalog/account data those flows operate on.
 */

const BCRYPT_COST = 10;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

interface SeedUserInput {
  username: string;
  password: string;
  email: string;
  phone: string;
  roles: RoleType[];
}

async function upsertUser(input: SeedUserInput): Promise<{ id: string; username: string }> {
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);

  const user = await prisma.user.upsert({
    where: { username: input.username },
    create: {
      username: input.username,
      email: input.email,
      phone: input.phone,
      passwordHash,
      roles: { create: input.roles.map((roleType) => ({ roleType })) },
    },
    update: {
      passwordHash,
      email: input.email,
      phone: input.phone,
    },
  });

  // Ensure every requested role is attached even if the user already existed
  // from a prior seed run with a different role set (idempotent via the
  // userId_roleType unique constraint, same pattern as src/seed/admin.ts).
  for (const roleType of input.roles) {
    await prisma.userRole.upsert({
      where: { userId_roleType: { userId: user.id, roleType } },
      create: { userId: user.id, roleType },
      update: {},
    });
  }

  return { id: user.id, username: user.username };
}

async function upsertStore(
  sellerUserId: string,
  storeName: string,
  description: string,
): Promise<{ id: string; storeName: string }> {
  const store = await prisma.store.upsert({
    where: { storeName },
    create: { sellerUserId, storeName, description },
    update: { description },
  });
  return { id: store.id, storeName: store.storeName };
}

interface SeedProductInput {
  name: string;
  description: string;
  price: number;
  stock: number;
}

async function upsertProduct(storeId: string, input: SeedProductInput): Promise<void> {
  // Product has no unique constraint beyond `id`, so idempotency here is a
  // manual find-then-write keyed on (storeId, name) — the natural identity
  // of "this seed's copy of this product" for a given store.
  const existing = await prisma.product.findFirst({ where: { storeId, name: input.name } });
  if (existing) {
    await prisma.product.update({
      where: { id: existing.id },
      data: {
        description: input.description,
        price: input.price,
        stock: input.stock,
        isDeleted: false,
      },
    });
    return;
  }
  await prisma.product.create({
    data: {
      storeId,
      name: input.name,
      description: input.description,
      price: input.price,
      stock: input.stock,
    },
  });
}

/**
 * Ensures a wallet exists with at least `minBalance`. Only sets the balance
 * (and writes the audit TOPUP transaction) on first creation — a second seed
 * run must never reset a balance that demo usage has since changed, so an
 * already-existing wallet is left untouched.
 */
async function ensureWalletWithBalance(buyerUserId: string, minBalance: number): Promise<void> {
  const existing = await prisma.wallet.findUnique({ where: { buyerUserId } });
  if (existing) return;

  const wallet = await prisma.wallet.create({ data: { buyerUserId, balance: minBalance } });
  await prisma.walletTransaction.create({
    data: { walletId: wallet.id, type: 'TOPUP', amount: minBalance, orderId: null },
  });
}

interface SeedAddressInput {
  label: string;
  recipientName: string;
  phone: string;
  fullAddress: string;
}

/** Only seeds a default address if the buyer has none yet — never duplicates on re-run. */
async function ensureDefaultAddress(buyerUserId: string, input: SeedAddressInput): Promise<void> {
  const existing = await prisma.address.findFirst({ where: { buyerUserId } });
  if (existing) return;

  await prisma.address.create({
    data: {
      buyerUserId,
      label: input.label,
      recipientName: input.recipientName,
      phone: input.phone,
      fullAddress: input.fullAddress,
      isDefault: true,
    },
  });
}

interface SeedVoucherInput {
  code: string;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  usageLimit: number;
}

async function upsertVoucher(createdByAdminId: string, input: SeedVoucherInput): Promise<void> {
  const expiryDate = new Date(Date.now() + THIRTY_DAYS_MS);
  await prisma.voucher.upsert({
    where: { code: input.code },
    create: {
      createdByAdminId,
      code: input.code,
      discountType: input.discountType,
      discountValue: input.discountValue,
      usageLimit: input.usageLimit,
      usageRemaining: input.usageLimit,
      expiryDate,
    },
    // usageRemaining is deliberately NOT reset here: a re-run must not undo
    // quota consumed by demo checkouts since the last seed. expiryDate is
    // refreshed forward so the demo voucher never goes stale between runs.
    update: {
      discountType: input.discountType,
      discountValue: input.discountValue,
      usageLimit: input.usageLimit,
      expiryDate,
    },
  });
}

interface SeedPromoInput {
  code: string;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
}

async function upsertPromo(createdByAdminId: string, input: SeedPromoInput): Promise<void> {
  const expiryDate = new Date(Date.now() + THIRTY_DAYS_MS);
  await prisma.promo.upsert({
    where: { code: input.code },
    create: {
      createdByAdminId,
      code: input.code,
      discountType: input.discountType,
      discountValue: input.discountValue,
      expiryDate,
    },
    update: {
      discountType: input.discountType,
      discountValue: input.discountValue,
      expiryDate,
    },
  });
}

interface SeedReviewInput {
  reviewerName: string;
  rating: number;
  comment: string;
  userId?: string;
}

/** Only seeds reviews if none exist yet at all — cheap guard against duplicate inserts on re-run. */
async function seedReviewsIfEmpty(reviews: SeedReviewInput[]): Promise<void> {
  const count = await prisma.appReview.count();
  if (count > 0) return;

  for (const review of reviews) {
    await prisma.appReview.create({
      data: {
        reviewerName: review.reviewerName,
        rating: review.rating,
        comment: review.comment,
        userId: review.userId ?? null,
      },
    });
  }
}

async function main(): Promise<void> {
  console.log('Seeding SEAPEDIA demo data...');

  // --- Admin ---------------------------------------------------------------
  const admin = await upsertUser({
    username: 'admin',
    password: 'admin123',
    email: 'admin@seapedia.local',
    phone: '080000000000',
    roles: ['ADMIN'],
  });

  // --- Sellers + stores + products -----------------------------------------
  const tokoMaju = await upsertUser({
    username: 'toko_maju',
    password: 'password123',
    email: 'toko_maju@seapedia.local',
    phone: '081100000001',
    roles: ['SELLER'],
  });
  const tokoMajuStore = await upsertStore(
    tokoMaju.id,
    'Toko Maju',
    'Warung makan & minuman rumahan, siap kirim.',
  );
  const tokoMajuProducts: SeedProductInput[] = [
    { name: 'Kopi Susu Gula Aren', description: 'Kopi susu manis dengan gula aren asli', price: 18000, stock: 50 },
    { name: 'Roti Bakar Coklat', description: 'Roti bakar isi coklat keju', price: 15000, stock: 30 },
    { name: 'Nasi Goreng Spesial', description: 'Nasi goreng dengan telur, ayam, dan kerupuk', price: 25000, stock: 20 },
    { name: 'Es Teh Manis', description: 'Es teh manis segar', price: 5000, stock: 100 },
    { name: 'Ayam Geprek', description: 'Ayam geprek sambal bawang level pedas custom', price: 20000, stock: 40 },
  ];
  for (const product of tokoMajuProducts) {
    await upsertProduct(tokoMajuStore.id, product);
  }

  const sinarJaya = await upsertUser({
    username: 'sinar_jaya',
    password: 'password123',
    email: 'sinar_jaya@seapedia.local',
    phone: '081100000002',
    roles: ['SELLER'],
  });
  const sinarJayaStore = await upsertStore(
    sinarJaya.id,
    'Sinar Jaya',
    'Toko pakaian dan aksesoris kasual.',
  );
  const sinarJayaProducts: SeedProductInput[] = [
    { name: 'Kaos Polos Cotton', description: 'Kaos polos katun combed 30s, unisex', price: 45000, stock: 25 },
    { name: 'Celana Jeans Slim Fit', description: 'Celana jeans slim fit warna biru dongker', price: 150000, stock: 15 },
    { name: 'Topi Baseball', description: 'Topi baseball adjustable, berbagai warna', price: 35000, stock: 20 },
  ];
  for (const product of sinarJayaProducts) {
    await upsertProduct(sinarJayaStore.id, product);
  }

  // --- Buyer -----------------------------------------------------------------
  const budi = await upsertUser({
    username: 'budi',
    password: 'password123',
    email: 'budi@seapedia.local',
    phone: '081200000001',
    roles: ['BUYER'],
  });
  await ensureWalletWithBalance(budi.id, 1_000_000);
  await ensureDefaultAddress(budi.id, {
    label: 'Rumah',
    recipientName: 'Budi Santoso',
    phone: '081200000001',
    fullAddress: 'Jl. Merdeka No. 10, Jakarta Selatan, DKI Jakarta',
  });

  // --- Driver ------------------------------------------------------------
  await upsertUser({
    username: 'kurir_cepat',
    password: 'password123',
    email: 'kurir_cepat@seapedia.local',
    phone: '081300000001',
    roles: ['DRIVER'],
  });

  // --- Multi-role: rangga (BUYER + SELLER + DRIVER) -----------------------
  const rangga = await upsertUser({
    username: 'rangga',
    password: 'password123',
    email: 'rangga@seapedia.local',
    phone: '081400000001',
    roles: ['BUYER', 'SELLER', 'DRIVER'],
  });
  const ranggaStore = await upsertStore(
    rangga.id,
    'Rangga Store',
    'Alat tulis dan perlengkapan kantor.',
  );
  const ranggaProducts: SeedProductInput[] = [
    { name: 'Buku Catatan A5', description: 'Buku catatan hardcover A5, 100 lembar', price: 12000, stock: 60 },
    { name: 'Pulpen Gel Set', description: 'Set 5 pulpen gel warna-warni', price: 18000, stock: 40 },
  ];
  for (const product of ranggaProducts) {
    await upsertProduct(ranggaStore.id, product);
  }
  await ensureWalletWithBalance(rangga.id, 500_000);
  await ensureDefaultAddress(rangga.id, {
    label: 'Kos',
    recipientName: 'Rangga Pratama',
    phone: '081400000001',
    fullAddress: 'Jl. Sudirman No. 25, Bandung, Jawa Barat',
  });

  // --- Discounts (voucher + promo), created by admin ------------------------
  await upsertVoucher(admin.id, {
    code: 'HEMAT10',
    discountType: 'PERCENT',
    discountValue: 10,
    usageLimit: 5,
  });
  await upsertPromo(admin.id, {
    code: 'PROMOHEMAT',
    discountType: 'FIXED',
    discountValue: 5000,
  });

  // --- App reviews -----------------------------------------------------------
  await seedReviewsIfEmpty([
    {
      reviewerName: 'Siti Rahma',
      rating: 5,
      comment: 'Aplikasinya gampang dipakai, checkout cepat dan diskonnya jelas!',
    },
    {
      reviewerName: 'Andi Wijaya',
      rating: 4,
      comment: 'Bagus, cuma berharap ada lebih banyak metode pembayaran ke depannya.',
    },
    {
      reviewerName: 'Guest Pengunjung',
      rating: 5,
      comment: 'Suka fitur pelacakan pesanan real-time, mantap!',
    },
    {
      reviewerName: budi.username,
      rating: 5,
      comment: 'Sebagai pembeli, saya suka riwayat pesanan dan wallet-nya jelas.',
      userId: budi.id,
    },
  ]);

  // --- Summary ---------------------------------------------------------------
  console.log('\nSEAPEDIA demo data ready:\n');
  console.log('Role       | Username      | Password     | Notes');
  console.log('-----------|---------------|--------------|-----------------------------------');
  console.log('ADMIN      | admin         | admin123     | creates vouchers/promos, monitoring');
  console.log('SELLER     | toko_maju     | password123  | store "Toko Maju", 5 products');
  console.log('SELLER     | sinar_jaya    | password123  | store "Sinar Jaya", 3 products');
  console.log('BUYER      | budi          | password123  | wallet 1,000,000 + default address');
  console.log('DRIVER     | kurir_cepat   | password123  | no active job yet');
  console.log('BUYER+     | rangga        | password123  | store "Rangga Store", 2 products,');
  console.log('SELLER+    |               |              | wallet 500,000 + address');
  console.log('DRIVER     |               |              |');
  console.log('\nVoucher: HEMAT10 (PERCENT 10%, quota 5, expires in 30 days)');
  console.log('Promo:   PROMOHEMAT (FIXED 5000, expires in 30 days)');
  console.log('\nRun again any time — this script is idempotent (safe to re-run).');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
