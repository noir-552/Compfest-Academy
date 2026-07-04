import { useEffect, useState } from 'react';
import * as sellerApi from '../../api/seller';
import { ApiClientError } from '../../api/client';
import { Card } from '../../ui/Card';
import { StoreForm } from './seller/StoreForm';
import { ProductList } from './seller/ProductList';

export function SellerDash() {
  const [store, setStore] = useState<sellerApi.SellerStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    sellerApi
      .getOwnStore()
      .then((res) => setStore(res.store))
      .catch((err) => {
        // 404 STORE_NOT_FOUND just means the seller hasn't created a store
        // yet — show the create-store form instead of an error state.
        if (err instanceof ApiClientError && err.status === 404) {
          setStore(null);
        } else {
          setError('Gagal memuat toko.');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-2xl font-bold text-slate-900">Dashboard Penjual</h1>

      {loading && (
        <Card className="mt-4">
          <p className="text-sm text-slate-500">Memuat toko...</p>
        </Card>
      )}
      {error && (
        <Card className="mt-4">
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        </Card>
      )}

      {!loading && !error && (
        <div className="mt-4 flex flex-col gap-6">
          <StoreForm store={store} onSaved={setStore} />
          {store ? (
            <ProductList />
          ) : (
            <Card>
              <p className="text-sm text-slate-500">Buat toko terlebih dahulu untuk mulai menambahkan produk.</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
