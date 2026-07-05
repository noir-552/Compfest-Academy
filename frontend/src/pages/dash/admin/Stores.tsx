import { useEffect, useState } from 'react';
import * as adminApi from '../../../api/admin';
import { Card } from '../../../ui/Card';
import { Table, type TableColumn } from '../../../ui/Table';

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('id-ID', { dateStyle: 'medium' });
}

/** Admin monitoring: every store with its seller's username and live product count. */
export function Stores() {
  const [stores, setStores] = useState<adminApi.AdminStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .listStores()
      .then((res) => setStores(res.stores))
      .catch(() => setError('Gagal memuat toko.'))
      .finally(() => setLoading(false));
  }, []);

  const columns: TableColumn<adminApi.AdminStore>[] = [
    { key: 'storeName', header: 'Nama Toko', render: (s) => s.storeName },
    { key: 'sellerUsername', header: 'Penjual', render: (s) => s.sellerUsername },
    { key: 'productCount', header: 'Jumlah Produk', render: (s) => s.productCount },
    { key: 'createdAt', header: 'Dibuat', render: (s) => formatDate(s.createdAt) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900">Toko</h1>
      <Card>
        {loading && <p className="text-sm text-slate-500">Memuat toko...</p>}
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {!loading && !error && (
          <Table columns={columns} rows={stores} rowKey={(s) => s.id} emptyMessage="Belum ada toko." />
        )}
      </Card>
    </div>
  );
}
