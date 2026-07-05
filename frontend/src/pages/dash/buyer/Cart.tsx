import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import * as buyerApi from '../../../api/buyer';
import { ApiClientError } from '../../../api/client';
import { useCart } from '../../../cart/CartContext';
import { formatRupiah } from '../../../lib/format';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Card';
import { EmptyState } from '../../../ui/EmptyState';
import { SkeletonList } from '../../../ui/Skeleton';

export function Cart() {
  const [cart, setCart] = useState<buyerApi.Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { refreshCart } = useCart();
  const navigate = useNavigate();

  function reload() {
    setLoading(true);
    setError(null);
    buyerApi
      .getCart()
      .then((res) => setCart(res.cart))
      .catch(() => setError('Gagal memuat keranjang.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleQuantityChange(productId: string, quantity: number) {
    if (quantity < 1) return;
    setActionError(null);
    setBusyProductId(productId);
    try {
      const res = await buyerApi.updateCartItem(productId, quantity);
      setCart(res.cart);
      refreshCart();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : 'Gagal memperbarui jumlah.');
    } finally {
      setBusyProductId(null);
    }
  }

  async function handleRemove(productId: string) {
    setActionError(null);
    setBusyProductId(productId);
    try {
      const res = await buyerApi.removeCartItem(productId);
      setCart(res.cart);
      refreshCart();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : 'Gagal menghapus item.');
    } finally {
      setBusyProductId(null);
    }
  }

  async function handleClear() {
    setActionError(null);
    try {
      const res = await buyerApi.clearCart();
      setCart(res.cart);
      refreshCart();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : 'Gagal mengosongkan keranjang.');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900">Keranjang</h1>

      {loading && <SkeletonList rows={2} />}
      {error && (
        <Card>
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        </Card>
      )}

      {!loading && !error && cart && cart.items.length === 0 && (
        <Card>
          <EmptyState
            heading="Keranjang kosong"
            teachLine="Tambahkan produk dari satu toko untuk mulai belanja — kamu hanya bisa berbelanja dari satu toko per transaksi."
            action={
              <Link to="/catalog" className="text-sm font-medium text-teal-700">
                Jelajahi katalog →
              </Link>
            }
          />
        </Card>
      )}

      {!loading && !error && cart && cart.items.length > 0 && (
        <>
          {cart.store && (
            <p className="text-sm text-slate-500">
              Toko: <span className="font-semibold text-slate-900">{cart.store.storeName}</span>
            </p>
          )}

          {actionError && (
            <p className="text-sm text-red-600" role="alert">
              {actionError}
            </p>
          )}

          <div className="flex flex-col gap-3">
            {cart.items.map((item) => (
              <Card key={item.product.id}>
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{item.product.name}</p>
                    <p className="tabular text-sm text-slate-500">{formatRupiah(item.product.price)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      aria-label={`Kurangi jumlah ${item.product.name}`}
                      disabled={busyProductId === item.product.id || item.quantity <= 1}
                      onClick={() => handleQuantityChange(item.product.id, item.quantity - 1)}
                    >
                      −
                    </Button>
                    <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                    <Button
                      variant="secondary"
                      aria-label={`Tambah jumlah ${item.product.name}`}
                      disabled={busyProductId === item.product.id || item.quantity >= item.product.stock}
                      onClick={() => handleQuantityChange(item.product.id, item.quantity + 1)}
                    >
                      +
                    </Button>
                  </div>
                  <p className="tabular w-28 flex-shrink-0 text-right text-sm font-semibold text-slate-900">
                    {formatRupiah(item.lineTotal)}
                  </p>
                  <Button
                    variant="danger"
                    disabled={busyProductId === item.product.id}
                    onClick={() => handleRemove(item.product.id)}
                  >
                    Hapus
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          <Card>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">Subtotal</p>
              <p className="tabular text-lg font-bold text-slate-900">{formatRupiah(cart.subtotal)}</p>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={handleClear}>
                Kosongkan keranjang
              </Button>
              <Button onClick={() => navigate('/dashboard/buyer/checkout')}>Lanjut ke checkout</Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
