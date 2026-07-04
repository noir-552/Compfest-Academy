import { Link, useParams } from 'react-router';
// Level 1 placeholder: reads from the local dummy data module. Level 2
// replaces this with the real product API (see src/data/products.ts).
import { getProductById } from '../data/products';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

export function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const product = id ? getProductById(id) : undefined;

  if (!product) {
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
          <Badge tone="info" className="w-fit">
            {product.storeName}
          </Badge>
          <h1 className="text-2xl font-bold text-slate-900">{product.name}</h1>
          <p className="text-xl font-bold text-slate-900">Rp {product.price.toLocaleString('id-ID')}</p>
          <p className="text-sm text-slate-500">
            {product.category} · ⭐ {product.rating.toFixed(1)}
          </p>
          <Card>
            <p className="text-sm text-slate-600">{product.description}</p>
          </Card>
          <Button type="button" className="mt-2 w-fit">
            Tambah ke keranjang
          </Button>
        </div>
      </div>
    </div>
  );
}
