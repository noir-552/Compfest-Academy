import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { getStore, type PublicStoreDetail } from '../api/catalog';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';

export function StorePage() {
  const { id } = useParams<{ id: string }>();
  const [store, setStore] = useState<PublicStoreDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotFound(false);
    getStore(id)
      .then((res) => setStore(res.store))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <p className="text-sm text-slate-500">Memuat toko...</p>
      </div>
    );
  }

  if (notFound || !store) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Toko tidak ditemukan</h1>
        <Link to="/catalog" className="mt-4 inline-block text-sm font-medium text-teal-700">
          Kembali ke katalog
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Badge tone="info" className="w-fit">
        Toko
      </Badge>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">{store.storeName}</h1>
      {store.description && <p className="mt-1 max-w-2xl text-sm text-slate-600">{store.description}</p>}

      <h2 className="mt-8 text-lg font-semibold text-slate-900">Produk</h2>
      {store.products.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Toko ini belum memiliki produk.</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {store.products.map((product) => (
            <Link key={product.id} to={`/product/${product.id}`}>
              <Card className="h-full">
                <div className="mb-3 aspect-square w-full rounded-lg bg-slate-100" />
                <h3 className="text-sm font-semibold text-slate-900">{product.name}</h3>
                <p className="mt-1 text-sm font-bold text-slate-900">Rp {product.price.toLocaleString('id-ID')}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
