import { useEffect, useState } from 'react';
import * as driverApi from '../../../api/driver';
import { formatRupiah } from '../../../lib/format';
import { Card } from '../../../ui/Card';
import { Table, type TableColumn } from '../../../ui/Table';

function formatDate(value: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Driver earnings summary: total + completed count stat cards, plus the underlying job list. */
export function Earnings() {
  const [earnings, setEarnings] = useState<driverApi.DriverEarnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    driverApi
      .getEarnings()
      .then(setEarnings)
      .catch(() => setError('Gagal memuat pendapatan.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card>
        <p className="text-sm text-slate-500">Memuat pendapatan...</p>
      </Card>
    );
  }

  if (error || !earnings) {
    return (
      <Card>
        <p className="text-sm text-red-600" role="alert">
          {error ?? 'Gagal memuat pendapatan.'}
        </p>
      </Card>
    );
  }

  const columns: TableColumn<driverApi.DriverEarningLine>[] = [
    { key: 'orderId', header: 'ID Pesanan', render: (job) => `#${job.orderId.slice(0, 8)}` },
    { key: 'earning', header: 'Pendapatan', render: (job) => formatRupiah(job.driverEarning) },
    { key: 'completedAt', header: 'Selesai Pada', render: (job) => formatDate(job.completedAt) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-xs font-medium text-slate-500">Total Pendapatan</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{formatRupiah(earnings.totalEarnings)}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-slate-500">Jumlah Selesai</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{earnings.completedCount}</p>
        </Card>
      </div>

      <Card>
        <Table
          columns={columns}
          rows={earnings.jobs}
          rowKey={(job) => job.id}
          emptyMessage="Belum ada pendapatan."
        />
      </Card>
    </div>
  );
}
