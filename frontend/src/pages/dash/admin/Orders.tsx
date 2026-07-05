import { useEffect, useState } from 'react';
import * as adminApi from '../../../api/admin';
import { formatRupiah } from '../../../lib/format';
import { Card } from '../../../ui/Card';
import { StatusPill } from '../../../ui/StatusPill';
import { Table, type TableColumn } from '../../../ui/Table';

function formatDate(value: string): string {
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Admin monitoring: every order (newest first) with buyer/store identifiers, status, and total. */
export function Orders() {
  const [orders, setOrders] = useState<adminApi.AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .listOrders()
      .then((res) => setOrders(res.orders))
      .catch(() => setError('Gagal memuat pesanan.'))
      .finally(() => setLoading(false));
  }, []);

  const columns: TableColumn<adminApi.AdminOrder>[] = [
    { key: 'id', header: 'ID Pesanan', render: (o) => `#${o.id.slice(0, 8)}` },
    { key: 'buyerUsername', header: 'Pembeli', render: (o) => o.buyerUsername },
    { key: 'storeName', header: 'Toko', render: (o) => o.storeName },
    {
      key: 'currentStatus',
      header: 'Status',
      render: (o) => <StatusPill status={o.currentStatus} />,
    },
    { key: 'finalTotal', header: 'Total', render: (o) => formatRupiah(o.finalTotal) },
    { key: 'createdAt', header: 'Dibuat', render: (o) => formatDate(o.createdAt) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900">Pesanan</h1>
      <Card>
        {loading && <p className="text-sm text-slate-500">Memuat pesanan...</p>}
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {!loading && !error && (
          <Table columns={columns} rows={orders} rowKey={(o) => o.id} emptyMessage="Belum ada pesanan." />
        )}
      </Card>
    </div>
  );
}
