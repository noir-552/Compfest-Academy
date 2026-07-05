import { useEffect, useState } from 'react';
import * as driverApi from '../../../api/driver';
import { ApiClientError } from '../../../api/client';
import { DELIVERY_METHOD_LABEL, type DeliveryMethod } from '../../../api/buyer';
import { formatRupiah } from '../../../lib/format';
import { Badge } from '../../../ui/Badge';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Card';

function methodLabel(method: string): string {
  return DELIVERY_METHOD_LABEL[method as DeliveryMethod] ?? method;
}

/**
 * Jobs up for grabs. Taking a job can fail three ways: JOB_ALREADY_TAKEN
 * (another driver won the race — refresh the list so the stale card goes
 * away), DRIVER_BUSY (this driver already has an active job), and
 * SELF_DELIVERY_FORBIDDEN (can't deliver your own order). All three surface
 * inline; only JOB_ALREADY_TAKEN triggers a refetch.
 */
export function AvailableJobs() {
  const [jobs, setJobs] = useState<driverApi.DriverJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [takingId, setTakingId] = useState<string | null>(null);
  const [takeError, setTakeError] = useState<string | null>(null);

  function reload() {
    setLoading(true);
    setError(null);
    return driverApi
      .listAvailableJobs()
      .then((res) => setJobs(res.jobs))
      .catch(() => setError('Gagal memuat job.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleTake(id: string) {
    setTakingId(id);
    setTakeError(null);
    try {
      await driverApi.takeJob(id);
      setJobs((prev) => prev.filter((job) => job.id !== id));
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Gagal mengambil job.';
      setTakeError(message);
      if (err instanceof ApiClientError && err.code === 'JOB_ALREADY_TAKEN') {
        await reload();
      }
    } finally {
      setTakingId(null);
    }
  }

  if (loading) {
    return (
      <Card>
        <p className="text-sm text-slate-500">Memuat job...</p>
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

  return (
    <div className="flex flex-col gap-3">
      {takeError && (
        <p className="text-sm text-red-600" role="alert">
          {takeError}
        </p>
      )}

      {jobs.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">Belum ada job yang tersedia.</p>
        </Card>
      ) : (
        jobs.map((job) => (
          <Card key={job.id}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">{job.order.storeName}</p>
                <p className="text-xs text-slate-500">{job.order.fullAddressSnapshot}</p>
                <p className="text-xs text-slate-500">{job.order.recipientNameSnapshot}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge tone="info">{methodLabel(job.order.deliveryMethod)}</Badge>
                  <span className="text-xs text-slate-500">{job.order.itemCount} item</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <p className="text-sm font-semibold text-slate-900">{formatRupiah(job.order.deliveryFee)}</p>
                <Button onClick={() => handleTake(job.id)} disabled={takingId === job.id}>
                  {takingId === job.id ? 'Mengambil...' : 'Ambil Job'}
                </Button>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
