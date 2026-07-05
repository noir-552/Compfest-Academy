import { useEffect, useState } from 'react';
import * as driverApi from '../../../api/driver';
import { ApiClientError } from '../../../api/client';
import { DELIVERY_METHOD_LABEL, type DeliveryMethod } from '../../../api/buyer';
import { formatRupiah } from '../../../lib/format';
import { Badge } from '../../../ui/Badge';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Card';
import { Modal } from '../../../ui/Modal';

function methodLabel(method: string): string {
  return DELIVERY_METHOD_LABEL[method as DeliveryMethod] ?? method;
}

/** The driver's single active (TAKEN) job, if any, with a confirm-before-complete flow. */
export function MyJob() {
  const [job, setJob] = useState<driverApi.DriverJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  useEffect(() => {
    driverApi
      .getMyJobs()
      .then((res) => setJob(res.active))
      .catch(() => setError('Gagal memuat job aktif.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleComplete() {
    if (!job) return;
    setCompleting(true);
    setCompleteError(null);
    try {
      const res = await driverApi.completeJob(job.id);
      setJob(null);
      setConfirmOpen(false);
      void res;
    } catch (err) {
      setCompleteError(err instanceof ApiClientError ? err.message : 'Gagal menyelesaikan pengiriman.');
    } finally {
      setCompleting(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <p className="text-sm text-slate-500">Memuat job aktif...</p>
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

  if (!job) {
    return (
      <Card>
        <p className="text-sm text-slate-500">Belum ada job aktif. Ambil job dari tab "Job Tersedia".</p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">{job.order.storeName}</p>
          <p className="text-xs text-slate-500">{job.order.fullAddressSnapshot}</p>
          <p className="text-xs text-slate-500">{job.order.recipientNameSnapshot}</p>
          <div className="mt-2 flex items-center gap-2">
            <Badge tone="info">{methodLabel(job.order.deliveryMethod)}</Badge>
            <span className="text-xs text-slate-500">{job.order.itemCount} item</span>
          </div>
        </div>
        <p className="text-sm font-semibold text-slate-900">{formatRupiah(job.order.deliveryFee)}</p>
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          onClick={() => {
            setCompleteError(null);
            setConfirmOpen(true);
          }}
        >
          Selesaikan Pengiriman
        </Button>
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Selesaikan pengiriman">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            Yakin pesanan dari <span className="font-semibold">{job.order.storeName}</span> sudah diantar sampai
            tujuan?
          </p>
          {completeError && (
            <p className="text-sm text-red-600" role="alert">
              {completeError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={completing}>
              Batal
            </Button>
            <Button onClick={handleComplete} disabled={completing}>
              {completing ? 'Menyelesaikan...' : 'Ya, Selesai'}
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
