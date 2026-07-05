import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router';
import { ProductDetail } from '../ProductDetail';
import { ApiClientError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { useCart } from '../../cart/CartContext';

// ProductDetail depends on the catalog API (product lookup), the buyer cart
// API (add-to-cart), the auth context (must be a signed-in BUYER to see the
// add-to-cart form), and the cart badge context. Mocking all four lets this
// test drive the store-conflict dialog without a real backend.
vi.mock('../../api/catalog', () => ({
  getProduct: vi.fn(),
}));
vi.mock('../../api/buyer', () => ({
  addCartItem: vi.fn(),
  clearCart: vi.fn(),
}));
vi.mock('../../auth/AuthContext', async () => {
  const actual = await vi.importActual<typeof import('../../auth/AuthContext')>('../../auth/AuthContext');
  return { ...actual, useAuth: vi.fn() };
});
vi.mock('../../cart/CartContext', async () => {
  const actual = await vi.importActual<typeof import('../../cart/CartContext')>('../../cart/CartContext');
  return { ...actual, useCart: vi.fn() };
});

const mockUseAuth = vi.mocked(useAuth);
const mockUseCart = vi.mocked(useCart);

import * as catalogApi from '../../api/catalog';
import * as buyerApi from '../../api/buyer';

const mockGetProduct = vi.mocked(catalogApi.getProduct);
const mockAddCartItem = vi.mocked(buyerApi.addCartItem);
const mockClearCart = vi.mocked(buyerApi.clearCart);

const PRODUCT = {
  id: 'prod-1',
  name: 'Ikan Tuna Segar',
  price: 50000,
  stock: 10,
  imageUrl: null,
  description: 'Tuna segar hasil tangkapan hari ini.',
  store: { id: 'store-1', storeName: 'Toko Laut Biru', description: null },
};

function renderProductDetail() {
  return render(
    <MemoryRouter initialEntries={['/product/prod-1']}>
      <Routes>
        <Route path="/product/:id" element={<ProductDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProductDetail add-to-cart store-conflict dialog', () => {
  beforeEach(() => {
    mockGetProduct.mockReset();
    mockAddCartItem.mockReset();
    mockClearCart.mockReset();
    mockUseAuth.mockReset();
    mockUseCart.mockReset();

    mockGetProduct.mockResolvedValue({ product: PRODUCT });
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', username: 'budi', email: 'budi@example.com', phone: '081234567890' },
      roles: ['BUYER'],
      activeRole: 'BUYER',
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      setActiveRole: vi.fn(),
    });
    mockUseCart.mockReturnValue({ itemCount: 0, refreshCart: vi.fn() });
  });

  it('opens the "kosongkan keranjang" modal when adding to cart returns 409 CART_STORE_CONFLICT', async () => {
    mockAddCartItem.mockRejectedValueOnce(
      new ApiClientError(409, 'CART_STORE_CONFLICT', 'Your cart already has items from a different store.'),
    );

    renderProductDetail();

    const user = userEvent.setup();
    await screen.findByText('Ikan Tuna Segar');
    await user.click(screen.getByRole('button', { name: 'Tambah ke keranjang' }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Kosongkan keranjang & tambahkan/ })).toBeInTheDocument();
  });

  it('clears the cart then re-adds the product when the conflict is resolved', async () => {
    mockAddCartItem.mockRejectedValueOnce(
      new ApiClientError(409, 'CART_STORE_CONFLICT', 'Your cart already has items from a different store.'),
    );
    mockClearCart.mockResolvedValueOnce({ cart: { storeId: null, store: null, items: [], subtotal: 0 } });
    mockAddCartItem.mockResolvedValueOnce({
      cart: { storeId: 'store-1', store: { id: 'store-1', storeName: 'Toko Laut Biru' }, items: [], subtotal: 0 },
    });

    renderProductDetail();

    const user = userEvent.setup();
    await screen.findByText('Ikan Tuna Segar');
    await user.click(screen.getByRole('button', { name: 'Tambah ke keranjang' }));
    await waitFor(() => screen.getByRole('dialog'));

    await user.click(screen.getByRole('button', { name: /Kosongkan keranjang & tambahkan/ }));

    await waitFor(() => {
      expect(mockClearCart).toHaveBeenCalledTimes(1);
      expect(mockAddCartItem).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('does not show the conflict dialog for a non-conflict error', async () => {
    mockAddCartItem.mockRejectedValueOnce(new ApiClientError(400, 'INSUFFICIENT_STOCK', 'Stok tidak cukup'));

    renderProductDetail();

    const user = userEvent.setup();
    await screen.findByText('Ikan Tuna Segar');
    await user.click(screen.getByRole('button', { name: 'Tambah ke keranjang' }));

    await waitFor(() => {
      expect(screen.getByText('Stok tidak cukup')).toBeInTheDocument();
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
