import { Link } from 'react-router';
// Level 1 placeholder: reads from the local dummy data module. Level 2
// replaces this with the real product API (see src/data/products.ts).
import { DUMMY_PRODUCTS } from '../data/products';
import { Card } from '../ui/Card';

export function Catalog() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-2xl font-bold text-slate-900">Katalog produk</h1>
      <p className="mt-1 text-sm text-slate-500">Produk dari berbagai toko di SEAPEDIA.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {DUMMY_PRODUCTS.map((product) => (
          <Link key={product.id} to={`/product/${product.id}`}>
            <Card className="h-full">
              <div className="mb-3 aspect-square w-full rounded-lg bg-slate-100" />
              <p className="text-xs font-medium text-teal-700">{product.storeName}</p>
              <h3 className="mt-1 text-sm font-semibold text-slate-900">{product.name}</h3>
              <p className="mt-1 text-sm font-bold text-slate-900">Rp {product.price.toLocaleString('id-ID')}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
