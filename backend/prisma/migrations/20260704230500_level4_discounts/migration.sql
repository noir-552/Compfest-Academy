-- CreateTable
CREATE TABLE "Voucher" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdByAdminId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountType" TEXT NOT NULL,
    "discountValue" INTEGER NOT NULL,
    "usageLimit" INTEGER NOT NULL,
    "usageRemaining" INTEGER NOT NULL,
    "expiryDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Voucher_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Promo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdByAdminId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountType" TEXT NOT NULL,
    "discountValue" INTEGER NOT NULL,
    "expiryDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Promo_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buyerUserId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "addressId" TEXT NOT NULL,
    "voucherId" TEXT,
    "promoId" TEXT,
    "deliveryMethod" TEXT NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "deliveryFee" INTEGER NOT NULL,
    "ppnAmount" INTEGER NOT NULL,
    "finalTotal" INTEGER NOT NULL,
    "currentStatus" TEXT NOT NULL DEFAULT 'SEDANG_DIKEMAS',
    "isRefunded" BOOLEAN NOT NULL DEFAULT false,
    "isStockRestored" BOOLEAN NOT NULL DEFAULT false,
    "isVoucherRestored" BOOLEAN NOT NULL DEFAULT false,
    "recipientNameSnapshot" TEXT NOT NULL,
    "phoneSnapshot" TEXT NOT NULL,
    "fullAddressSnapshot" TEXT NOT NULL,
    "slaDeadline" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Order_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Order_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Order_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Order_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_promoId_fkey" FOREIGN KEY ("promoId") REFERENCES "Promo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("addressId", "buyerUserId", "createdAt", "currentStatus", "deliveryFee", "deliveryMethod", "discountAmount", "finalTotal", "fullAddressSnapshot", "id", "isRefunded", "isStockRestored", "isVoucherRestored", "phoneSnapshot", "ppnAmount", "recipientNameSnapshot", "slaDeadline", "storeId", "subtotal") SELECT "addressId", "buyerUserId", "createdAt", "currentStatus", "deliveryFee", "deliveryMethod", "discountAmount", "finalTotal", "fullAddressSnapshot", "id", "isRefunded", "isStockRestored", "isVoucherRestored", "phoneSnapshot", "ppnAmount", "recipientNameSnapshot", "slaDeadline", "storeId", "subtotal" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_code_key" ON "Voucher"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Promo_code_key" ON "Promo"("code");
