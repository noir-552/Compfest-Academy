import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { getProduct, type PublicProductDetail } from '../api/catalog';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

export function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<PublicProductDetail | null>(null);
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
    getProduct(id)
      .then((res) => setProduct(res.product))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

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
          <Button type="button" className="mt-2 w-fit">
            Tambah ke keranjang
          </Button>
        </div>
      </div>
    </div>
  );
}
