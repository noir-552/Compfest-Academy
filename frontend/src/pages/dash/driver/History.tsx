import { useEffect, useState } from 'react';
import * as driverApi from '../../../api/driver';
import { formatRupiah } from '../../../lib/format';
import { Card } from '../../../ui/Card';
import { Table, type TableColumn } from '../../../ui/Table';

function formatDate(value: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Completed delivery jobs for this driver. */
export function History() {
  const [jobs, setJobs] = useState<driverApi.DriverJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    driverApi
      .getMyJobs()
      .then((res) => setJobs(res.history))
      .catch(() => setError('Gagal memuat riwayat.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card>
        <p className="text-sm text-slate-500">Memuat riwayat...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      </Card>
    );
  }

  const columns: TableColumn<driverApi.DriverJob>[] = [
    { key: 'orderId', header: 'ID Pesanan', render: (job) => `#${job.order.id.slice(0, 8)}` },
    { key: 'earning', header: 'Pendapatan', render: (job) => formatRupiah(job.driverEarning) },
    { key: 'completedAt', header: 'Selesai Pada', render: (job) => formatDate(job.completedAt) },
  ];

  return (
    <Card>
      <Table columns={columns} rows={jobs} rowKey={(job) => job.id} emptyMessage="Belum ada riwayat pengiriman." />
    </Card>
  );
}
