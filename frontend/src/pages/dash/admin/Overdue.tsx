import { useEffect, useState } from 'react';
import * as adminApi from '../../../api/admin';
import { formatRupiah } from '../../../lib/format';
import { Badge } from '../../../ui/Badge';
import { Card } from '../../../ui/Card';
import { Table, type TableColumn } from '../../../ui/Table';
import { ORDER_STATUS_LABEL, orderStatusTone } from './statusLabels';

function formatDate(value: string): string {
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

const PENDING_COLUMNS: TableColumn<adminApi.OverdueOrder>[] = [
  { key: 'id', header: 'ID Pesanan', render: (o) => `#${o.id.slice(0, 8)}` },
  { key: 'buyerUsername', header: 'Pembeli', render: (o) => o.buyerUsername },
  { key: 'storeName', header: 'Toko', render: (o) => o.storeName },
  {
    key: 'currentStatus',
    header: 'Status',
    render: (o) => <Badge tone={orderStatusTone(o.currentStatus)}>{ORDER_STATUS_LABEL[o.currentStatus] ?? o.currentStatus}</Badge>,
  },
  { key: 'finalTotal', header: 'Total', render: (o) => formatRupiah(o.finalTotal) },
  { key: 'slaDeadline', header: 'Batas SLA', render: (o) => formatDate(o.slaDeadline) },
];

const RETURNED_COLUMNS: TableColumn<adminApi.OverdueOrder>[] = [
  { key: 'id', header: 'ID Pesanan', render: (o) => `#${o.id.slice(0, 8)}` },
  { key: 'buyerUsername', header: 'Pembeli', render: (o) => o.buyerUsername },
  { key: 'storeName', header: 'Toko', render: (o) => o.storeName },
  { key: 'finalTotal', header: 'Total', render: (o) => formatRupiah(o.finalTotal) },
  { key: 'createdAt', header: 'Dibuat', render: (o) => formatDate(o.createdAt) },
];

/** Admin monitoring: orders past their SLA deadline awaiting the next sweep, and orders the sweep already returned. */
export function Overdue() {
  const [overdue, setOverdue] = useState<adminApi.OverdueView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .getOverdue()
      .then(setOverdue)
      .catch(() => setError('Gagal memuat pesanan terlambat.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card>
        <p className="text-sm text-slate-500">Memuat pesanan terlambat...</p>
      </Card>
    );
  }

  if (error || !overdue) {
    return (
      <Card>
        <p className="text-sm text-red-600" role="alert">
          {error ?? 'Gagal memuat pesanan terlambat.'}
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900">Pesanan Terlambat</h1>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Menunggu Sweep ({overdue.pending.length})
        </h2>
        <Table
          columns={PENDING_COLUMNS}
          rows={overdue.pending}
          rowKey={(o) => o.id}
          emptyMessage="Tidak ada pesanan yang melewati batas SLA."
        />
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Sudah Dikembalikan ({overdue.returned.length})
        </h2>
        <Table
          columns={RETURNED_COLUMNS}
          rows={overdue.returned}
          rowKey={(o) => o.id}
          emptyMessage="Belum ada pesanan yang dikembalikan."
        />
      </Card>
    </div>
  );
}
