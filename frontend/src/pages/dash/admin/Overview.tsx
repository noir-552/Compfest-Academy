import { useEffect, useState } from 'react';
import * as adminApi from '../../../api/admin';
import { Badge } from '../../../ui/Badge';
import { Card } from '../../../ui/Card';
import { StatusPill } from '../../../ui/StatusPill';
import { JOB_STATUS_LABEL, jobStatusTone } from './statusLabels';

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('id-ID', { dateStyle: 'full' });
}

/** Admin dashboard landing tab: entity totals, order/job status breakdowns, and the current virtual date. */
export function Overview() {
  const [overview, setOverview] = useState<adminApi.AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .getOverview()
      .then(setOverview)
      .catch(() => setError('Gagal memuat ringkasan.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card>
        <p className="text-sm text-slate-500">Memuat ringkasan...</p>
      </Card>
    );
  }

  if (error || !overview) {
    return (
      <Card>
        <p className="text-sm text-red-600" role="alert">
          {error ?? 'Gagal memuat ringkasan.'}
        </p>
      </Card>
    );
  }

  const { counts } = overview;
  const statCards: { label: string; value: number }[] = [
    { label: 'Pengguna', value: counts.users },
    { label: 'Toko', value: counts.stores },
    { label: 'Produk', value: counts.products },
    { label: 'Voucher', value: counts.vouchers },
    { label: 'Promo', value: counts.promos },
    { label: 'Pesanan Terlambat', value: counts.overduePending },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">Tanggal Virtual</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{formatDate(overview.virtualDate)}</p>
        </div>
        <Badge tone="info">Waktu Simulasi</Badge>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {statCards.map((card) => (
          <Card key={card.label}>
            <p className="text-xs font-medium text-slate-500">{card.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{card.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Pesanan per Status</h2>
          <ul className="flex flex-col gap-2">
            {Object.entries(counts.ordersByStatus).map(([status, count]) => (
              <li key={status} className="flex items-center justify-between text-sm">
                <StatusPill status={status} />
                <span className="tabular font-medium text-slate-900">{count}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Job Pengiriman per Status</h2>
          <ul className="flex flex-col gap-2">
            {Object.entries(counts.jobsByStatus).map(([status, count]) => (
              <li key={status} className="flex items-center justify-between text-sm">
                <Badge tone={jobStatusTone(status)}>{JOB_STATUS_LABEL[status] ?? status}</Badge>
                <span className="font-medium text-slate-900">{count}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
