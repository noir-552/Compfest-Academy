import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { listProducts, type PublicProduct } from '../api/catalog';
import { ProductImage } from '../components/ProductImage';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';

export function Catalog() {
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    // Simple debounce: wait for a pause in typing before hitting the API.
    const timer = setTimeout(() => {
      listProducts({ search: search.trim() || undefined })
        .then((res) => {
          if (!cancelled) setProducts(res.products);
        })
        .catch(() => {
          if (!cancelled) setError('Gagal memuat produk.');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-2xl font-bold text-slate-900">Katalog produk</h1>
      <p className="mt-1 text-sm text-slate-500">Produk dari berbagai toko di SEAPEDIA.</p>

      <div className="mt-6 max-w-sm">
        <Input
          label="Cari produk"
          name="search"
          placeholder="Contoh: kopi"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="mt-6">
        {loading && <p className="text-sm text-slate-500">Memuat produk...</p>}
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {!loading && !error && products.length === 0 && (
          <p className="text-sm text-slate-500">Tidak ada produk ditemukan.</p>
        )}
        {!loading && !error && products.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <Link key={product.id} to={`/product/${product.id}`}>
                <Card className="h-full">
                  <ProductImage
                    imageUrl={product.imageUrl}
                    name={product.name}
                    className="mb-3 aspect-square w-full rounded-lg"
                  />
                  <p className="text-xs font-medium text-teal-700">{product.store.storeName}</p>
                  <h3 className="mt-1 text-sm font-semibold text-slate-900">{product.name}</h3>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    Rp {product.price.toLocaleString('id-ID')}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
