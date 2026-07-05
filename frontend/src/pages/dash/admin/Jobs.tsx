import { useEffect, useState } from 'react';
import * as adminApi from '../../../api/admin';
import { formatRupiah } from '../../../lib/format';
import { Badge } from '../../../ui/Badge';
import { Card } from '../../../ui/Card';
import { Table, type TableColumn } from '../../../ui/Table';
import { JOB_STATUS_LABEL, jobStatusTone } from './statusLabels';

function formatDate(value: string): string {
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Admin monitoring: every delivery job (newest first) with the order it belongs to and the assigned driver. */
export function Jobs() {
  const [jobs, setJobs] = useState<adminApi.AdminDeliveryJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .listDeliveryJobs()
      .then((res) => setJobs(res.jobs))
      .catch(() => setError('Gagal memuat job pengiriman.'))
      .finally(() => setLoading(false));
  }, []);

  const columns: TableColumn<adminApi.AdminDeliveryJob>[] = [
    { key: 'id', header: 'ID Job', render: (j) => `#${j.id.slice(0, 8)}` },
    { key: 'orderId', header: 'ID Pesanan', render: (j) => `#${j.orderId.slice(0, 8)}` },
    { key: 'driverUsername', header: 'Kurir', render: (j) => j.driverUsername ?? '-' },
    {
      key: 'status',
      header: 'Status',
      render: (j) => <Badge tone={jobStatusTone(j.status)}>{JOB_STATUS_LABEL[j.status] ?? j.status}</Badge>,
    },
    { key: 'driverEarning', header: 'Pendapatan Kurir', render: (j) => formatRupiah(j.driverEarning) },
    { key: 'createdAt', header: 'Dibuat', render: (j) => formatDate(j.createdAt) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900">Job Pengiriman</h1>
      <Card>
        {loading && <p className="text-sm text-slate-500">Memuat job pengiriman...</p>}
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {!loading && !error && (
          <Table columns={columns} rows={jobs} rowKey={(j) => j.id} emptyMessage="Belum ada job pengiriman." />
        )}
      </Card>
    </div>
  );
}
