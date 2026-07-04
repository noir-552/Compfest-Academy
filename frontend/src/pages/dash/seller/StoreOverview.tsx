import { useEffect, useState } from 'react';
import * as sellerApi from '../../../api/seller';
import { ApiClientError } from '../../../api/client';
import { Card } from '../../../ui/Card';
import { StoreForm } from './StoreForm';
import { ProductList } from './ProductList';

/** Store + product management, the seller dashboard's default tab. */
export function StoreOverview() {
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

  if (loading) {
    return (
      <Card>
        <p className="text-sm text-slate-500">Memuat toko...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <StoreForm store={store} onSaved={setStore} />
      {store ? (
        <ProductList />
      ) : (
        <Card>
          <p className="text-sm text-slate-500">Buat toko terlebih dahulu untuk mulai menambahkan produk.</p>
        </Card>
      )}
    </div>
  );
}
