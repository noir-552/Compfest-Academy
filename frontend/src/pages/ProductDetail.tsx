import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { getProduct, type PublicProductDetail } from '../api/catalog';
import * as buyerApi from '../api/buyer';
import { ApiClientError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useCart } from '../cart/CartContext';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';

export function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<PublicProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [resolvingConflict, setResolvingConflict] = useState(false);

  const { user, activeRole } = useAuth();
  const { refreshCart } = useCart();

  useEffect(() => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotFound(false);
    getProduct(id)
      .then((res) => setProduct(res.product))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleAddToCart() {
    if (!product) return;
    setAddError(null);
    setAddSuccess(false);
    setAdding(true);
    try {
      await buyerApi.addCartItem(product.id, quantity);
      refreshCart();
      setAddSuccess(true);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'CART_STORE_CONFLICT') {
        setConflictOpen(true);
      } else {
        setAddError(err instanceof ApiClientError ? err.message : 'Gagal menambahkan ke keranjang.');
      }
    } finally {
      setAdding(false);
    }
  }

  async function handleClearAndAdd() {
    if (!product) return;
    setResolvingConflict(true);
    setAddError(null);
    try {
      await buyerApi.clearCart();
      await buyerApi.addCartItem(product.id, quantity);
      refreshCart();
      setConflictOpen(false);
      setAddSuccess(true);
    } catch (err) {
      setAddError(err instanceof ApiClientError ? err.message : 'Gagal menambahkan ke keranjang.');
      setConflictOpen(false);
    } finally {
      setResolvingConflict(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-sm text-slate-500">Memuat produk...</p>
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Produk tidak ditemukan</h1>
        <Link to="/catalog" className="mt-4 inline-block text-sm font-medium text-teal-700">
          Kembali ke katalog
        </Link>
      </div>
    );
  }

  const canAddToCart = user && activeRole === 'BUYER';

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <Link to="/catalog" className="text-sm font-medium text-teal-700">
        ← Kembali ke katalog
      </Link>
      <div className="mt-4 grid grid-cols-1 gap-8 sm:grid-cols-2">
        <div className="aspect-square w-full rounded-xl bg-slate-100" />
        <div className="flex flex-col gap-3">
          <Link to={`/stores/${product.store.id}`} className="w-fit">
            <Badge tone="info">{product.store.storeName}</Badge>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">{product.name}</h1>
          <p className="text-xl font-bold text-slate-900">Rp {product.price.toLocaleString('id-ID')}</p>
          <p className="text-sm text-slate-500">Stok: {product.stock}</p>
          <Card>
            <p className="text-sm text-slate-600">{product.description ?? 'Tidak ada deskripsi.'}</p>
          </Card>
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Toko</p>
            <Link to={`/stores/${product.store.id}`} className="mt-1 block text-sm font-semibold text-teal-700">
              {product.store.storeName}
            </Link>
            {product.store.description && (
              <p className="mt-1 text-sm text-slate-600">{product.store.description}</p>
            )}
          </Card>

          {canAddToCart && product.stock > 0 && (
            <div className="flex items-end gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="quantity" className="text-sm font-medium text-slate-700">
                  Jumlah
                </label>
                <input
                  id="quantity"
                  type="number"
                  min={1}
                  max={product.stock}
                  step={1}
                  value={quantity}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setQuantity(Number.isInteger(value) && value >= 1 ? Math.min(value, product.stock) : 1);
                  }}
                  className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                />
              </div>
              <Button type="button" onClick={handleAddToCart} disabled={adding}>
                {adding ? 'Menambahkan...' : 'Tambah ke keranjang'}
              </Button>
            </div>
          )}

          {product.stock === 0 && <Badge tone="warning">Stok habis</Badge>}

          {!canAddToCart && (
            <p className="text-sm text-slate-500">
              <Link to="/login" className="font-medium text-teal-700">
                Masuk
              </Link>{' '}
              sebagai pembeli untuk menambahkan produk ke keranjang.
            </p>
          )}

          {addError && (
            <p className="text-sm text-red-600" role="alert">
              {addError}
            </p>
          )}
          {addSuccess && (
            <p className="text-sm text-emerald-600" role="status">
              Ditambahkan ke keranjang.{' '}
              <Link to="/dashboard/buyer/cart" className="font-medium underline">
                Lihat keranjang
              </Link>
            </p>
          )}
        </div>
      </div>

      <Modal open={conflictOpen} onClose={() => setConflictOpen(false)} title="Keranjang berisi toko lain">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            Keranjangmu berisi produk dari toko lain. Kamu hanya bisa checkout dari satu toko dalam satu waktu.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConflictOpen(false)}>
              Batal
            </Button>
            <Button variant="danger" onClick={handleClearAndAdd} disabled={resolvingConflict}>
              {resolvingConflict ? 'Memproses...' : 'Kosongkan keranjang & tambahkan'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
