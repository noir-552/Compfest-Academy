import { useEffect, useState } from 'react';
import * as adminApi from '../../../api/admin';
import { formatRupiah } from '../../../lib/format';
import { Badge } from '../../../ui/Badge';
import { Card } from '../../../ui/Card';
import { Table, type TableColumn } from '../../../ui/Table';

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('id-ID', { dateStyle: 'medium' });
}

/** Admin monitoring: every product (including soft-deleted ones) with its store name. */
export function Products() {
  const [products, setProducts] = useState<adminApi.AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .listProducts()
      .then((res) => setProducts(res.products))
      .catch(() => setError('Gagal memuat produk.'))
      .finally(() => setLoading(false));
  }, []);

  const columns: TableColumn<adminApi.AdminProduct>[] = [
    { key: 'name', header: 'Nama Produk', render: (p) => p.name },
    { key: 'storeName', header: 'Toko', render: (p) => p.storeName },
    { key: 'price', header: 'Harga', render: (p) => formatRupiah(p.price) },
    { key: 'stock', header: 'Stok', render: (p) => p.stock },
    {
      key: 'isDeleted',
      header: 'Status',
      render: (p) =>
        p.isDeleted ? <Badge tone="warning">Dihapus</Badge> : <Badge tone="success">Aktif</Badge>,
    },
    { key: 'createdAt', header: 'Dibuat', render: (p) => formatDate(p.createdAt) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900">Produk</h1>
      <Card>
        {loading && <p className="text-sm text-slate-500">Memuat produk...</p>}
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {!loading && !error && (
          <Table columns={columns} rows={products} rowKey={(p) => p.id} emptyMessage="Belum ada produk." />
        )}
      </Card>
    </div>
  );
}
