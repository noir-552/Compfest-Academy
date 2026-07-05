import { useEffect, useState } from 'react';
import * as adminApi from '../../../api/admin';
import { ApiClientError } from '../../../api/client';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Card';

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('id-ID', { dateStyle: 'full' });
}

/**
 * Drives the virtual clock forward one day and runs the overdue sweep,
 * rendering the resulting per-order action log so an admin can watch refunds,
 * restocks, voucher restores, and delivery-job cancellations happen live.
 */
export function Simulate() {
  const [virtualDate, setVirtualDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<adminApi.SweepResult[] | null>(null);

  useEffect(() => {
    adminApi
      .getOverview()
      .then((res) => setVirtualDate(res.virtualDate))
      .catch(() => setError('Gagal memuat tanggal virtual.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSimulate() {
    setSimulating(true);
    setError(null);
    try {
      const res = await adminApi.simulateNextDay();
      setVirtualDate(res.virtualDate);
      setLastResult(res.processed);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Gagal menjalankan simulasi.');
    } finally {
      setSimulating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900">Simulasi Waktu</h1>

      <Card className="flex flex-col items-center gap-4 py-10 text-center">
        <div>
          <p className="text-xs font-medium text-slate-500">Tanggal Virtual Saat Ini</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {loading ? 'Memuat...' : (virtualDate && formatDate(virtualDate)) ?? '-'}
          </p>
        </div>
        <Button onClick={handleSimulate} disabled={simulating || loading}>
          {simulating ? 'Memproses...' : 'Simulasikan Hari Berikutnya'}
        </Button>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </Card>

      {lastResult && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Hasil Sweep Terakhir</h2>
          {lastResult.length === 0 ? (
            <p className="text-sm text-slate-500">Tidak ada pesanan yang diproses pada sweep ini.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {lastResult.map((result) => (
                <li key={result.orderId} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <p className="font-semibold text-slate-900">Pesanan #{result.orderId.slice(0, 8)}</p>
                  <ul className="mt-1 list-inside list-disc text-slate-600">
                    {result.actions.map((action, idx) => (
                      <li key={idx}>{action}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
