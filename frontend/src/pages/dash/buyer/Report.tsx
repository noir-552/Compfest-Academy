import { useEffect, useState } from 'react';
import * as buyerApi from '../../../api/buyer';
import { formatRupiah } from '../../../lib/format';
import { Card } from '../../../ui/Card';
import { StatusPill } from '../../../ui/StatusPill';

export function Report() {
  const [report, setReport] = useState<buyerApi.BuyerReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    buyerApi
      .getBuyerReport()
      .then(setReport)
      .catch(() => setError('Gagal memuat laporan.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card>
        <p className="text-sm text-slate-500">Memuat laporan...</p>
      </Card>
    );
  }

  if (error || !report) {
    return (
      <Card>
        <p className="text-sm text-red-600" role="alert">
          {error ?? 'Gagal memuat laporan.'}
        </p>
      </Card>
    );
  }

  const statusEntries = Object.entries(report.byStatus);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-sm text-slate-500">Total Pengeluaran</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{formatRupiah(report.totalSpent)}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Jumlah Pesanan</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{report.orderCount}</p>
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Rincian per status</h2>
        {statusEntries.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada pesanan.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {statusEntries.map(([status, count]) => (
              <li key={status} className="flex items-center justify-between text-sm">
                <StatusPill status={status} />
                <span className="tabular font-medium text-slate-900">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
