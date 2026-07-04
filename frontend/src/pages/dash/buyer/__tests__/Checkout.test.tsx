import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { Checkout } from '../Checkout';
import { ApiClientError } from '../../../../api/client';
import { useCart } from '../../../../cart/CartContext';

// Checkout depends on the buyer API (addresses, preview, checkout), the
// discounts API (code validation), and the cart badge context. Mocking all
// three lets this test drive the discount-code apply/remove flow without a
// real backend, while asserting exactly what gets sent to previewCheckout.
vi.mock('../../../../api/buyer', async () => {
  const actual = await vi.importActual<typeof import('../../../../api/buyer')>('../../../../api/buyer');
  return {
    ...actual,
    listAddresses: vi.fn(),
    previewCheckout: vi.fn(),
    checkout: vi.fn(),
  };
});
vi.mock('../../../../api/discounts', () => ({
  validateDiscountCode: vi.fn(),
}));
vi.mock('../../../../cart/CartContext', async () => {
  const actual = await vi.importActual<typeof import('../../../../cart/CartContext')>('../../../../cart/CartContext');
  return { ...actual, useCart: vi.fn() };
});

const mockUseCart = vi.mocked(useCart);

import * as buyerApi from '../../../../api/buyer';
import * as discountsApi from '../../../../api/discounts';

const mockListAddresses = vi.mocked(buyerApi.listAddresses);
const mockPreviewCheckout = vi.mocked(buyerApi.previewCheckout);
const mockCheckout = vi.mocked(buyerApi.checkout);
const mockValidateDiscountCode = vi.mocked(discountsApi.validateDiscountCode);

const ADDRESS: buyerApi.Address = {
  id: 'addr-1',
  label: 'Rumah',
  recipientName: 'Budi',
  phone: '081234567890',
  fullAddress: 'Jl. Contoh No 1',
  isDefault: true,
};

function basePreview(overrides: Partial<buyerApi.CheckoutPreview> = {}): buyerApi.CheckoutPreview {
  return {
    storeId: 'store-1',
    items: [],
    totals: { subtotal: 100000, discountAmount: 0, deliveryFee: 10000, ppnAmount: 12000, finalTotal: 122000 },
    discounts: { voucher: null, promo: null },
    ...overrides,
  };
}

function renderCheckout() {
  return render(
    <MemoryRouter>
      <Checkout />
    </MemoryRouter>,
  );
}

describe('Checkout discount code apply flow', () => {
  beforeEach(() => {
    mockListAddresses.mockReset();
    mockPreviewCheckout.mockReset();
    mockCheckout.mockReset();
    mockValidateDiscountCode.mockReset();
    mockUseCart.mockReset();

    mockListAddresses.mockResolvedValue({ addresses: [ADDRESS] });
    mockUseCart.mockReturnValue({ itemCount: 0, refreshCart: vi.fn() });
  });

  it('applying a valid voucher shows its effect and passes voucherCode to the preview', async () => {
    mockPreviewCheckout.mockImplementation((input) => {
      if (input.voucherCode) {
        return Promise.resolve(
          basePreview({
            totals: {
              subtotal: 100000,
              discountAmount: 10000,
              deliveryFee: 10000,
              ppnAmount: 10800,
              finalTotal: 110800,
            },
            discounts: { voucher: { code: 'HEMAT10', amount: 10000 }, promo: null },
          }),
        );
      }
      return Promise.resolve(basePreview());
    });
    mockValidateDiscountCode.mockResolvedValue({
      kind: 'VOUCHER',
      code: 'HEMAT10',
      discountType: 'PERCENT',
      discountValue: 10,
      amount: 10000,
    });

    renderCheckout();
    const user = userEvent.setup();

    await screen.findByLabelText('Kode Voucher');
    await user.type(screen.getByLabelText('Kode Voucher'), 'hemat10');
    await user.click(screen.getAllByRole('button', { name: 'Terapkan' })[0]);

    await waitFor(() => {
      expect(screen.getAllByText('HEMAT10').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('Voucher').length).toBeGreaterThan(0);
    expect(screen.getAllByText('-Rp10.000').length).toBeGreaterThan(0);
    expect(mockValidateDiscountCode).toHaveBeenCalledWith('HEMAT10', 100000);

    await waitFor(() => {
      expect(mockPreviewCheckout).toHaveBeenCalledWith(expect.objectContaining({ voucherCode: 'HEMAT10' }));
    });
  });

  it('shows the backend message inline on 409 DISCOUNT_EXPIRED and does not pass the code to the preview', async () => {
    mockPreviewCheckout.mockResolvedValue(basePreview());
    mockValidateDiscountCode.mockRejectedValue(
      new ApiClientError(409, 'DISCOUNT_EXPIRED', 'Discount code has expired'),
    );

    renderCheckout();
    const user = userEvent.setup();

    await screen.findByLabelText('Kode Voucher');
    await user.type(screen.getByLabelText('Kode Voucher'), 'EXPIRED1');
    await user.click(screen.getAllByRole('button', { name: 'Terapkan' })[0]);

    await waitFor(() => {
      expect(screen.getByText('Discount code has expired')).toBeInTheDocument();
    });

    // No green applied summary, and the failed code never reaches the preview call.
    expect(screen.queryByText('EXPIRED1')).not.toBeInTheDocument();
    for (const call of mockPreviewCheckout.mock.calls) {
      expect(call[0]).not.toHaveProperty('voucherCode');
    }
    expect(mockCheckout).not.toHaveBeenCalled();
  });
});
