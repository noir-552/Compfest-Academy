import { useEffect, useState } from 'react';
import * as sellerApi from '../../../api/seller';
import { ApiClientError } from '../../../api/client';
import { OrderStatusTimeline } from '../../../components/OrderStatusTimeline';
import { formatRupiah } from '../../../lib/format';
import { Badge } from '../../../ui/Badge';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Card';

const STATUS_LABEL: Record<string, string> = {
  SEDANG_DIKEMAS: 'Sedang Dikemas',
  MENUNGGU_PENGIRIM: 'Menunggu Pengirim',
  SEDANG_DIKIRIM: 'Sedang Dikirim',
  PESANAN_SELESAI: 'Pesanan Selesai',
  DIKEMBALIKAN: 'Dikembalikan',
};

function statusTone(status: string): 'neutral' | 'success' | 'warning' | 'info' {
  if (status === 'PESANAN_SELESAI') return 'success';
  if (status === 'DIKEMBALIKAN') return 'warning';
  return 'info';
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('id-ID', { dateStyle: 'medium' });
}

/**
 * Own-store incoming orders. SEDANG_DIKEMAS orders get a "Proses Pesanan"
 * action (-> MENUNGGU_PENGIRIM); each row expands to show the full status
 * timeline. Processing updates the row in place from the response instead
 * of refetching the whole list. A 409 INVALID_STATUS (already processed by
 * a concurrent request) surfaces inline on that row only.
 */
export function IncomingOrders() {
  const [orders, setOrders] = useState<sellerApi.SellerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    sellerApi
      .listIncomingOrders()
      .then((res) => setOrders(res.orders))
      .catch(() => setError('Gagal memuat pesanan.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleProcess(id: string) {
    setProcessingId(id);
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      const res = await sellerApi.processOrder(id);
      setOrders((prev) => prev.map((order) => (order.id === id ? res.order : order)));
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Gagal memproses pesanan.';
      setRowErrors((prev) => ({ ...prev, [id]: message }));
    } finally {
      setProcessingId(null);
    }
  }

  if (loading) {
    return (
      <Card>
        <p className="text-sm text-slate-500">Memuat pesanan...</p>
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

  if (orders.length === 0) {
    return (
      <Card>
        <p className="text-sm text-slate-500">Belum ada pesanan masuk.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {orders.map((order) => {
        const expanded = expandedId === order.id;
        return (
          <Card key={order.id}>
            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                className="flex flex-1 items-center justify-between gap-4 text-left"
                onClick={() => setExpandedId(expanded ? null : order.id)}
                aria-expanded={expanded}
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">Pesanan #{order.id.slice(0, 8)}</p>
                  <p className="text-xs text-slate-500">
                    {order.buyerUsername} · {formatDate(order.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold text-slate-900">{formatRupiah(order.finalTotal)}</p>
                  <Badge tone={statusTone(order.currentStatus)}>
                    {STATUS_LABEL[order.currentStatus] ?? order.currentStatus}
                  </Badge>
                </div>
              </button>
              {order.currentStatus === 'SEDANG_DIKEMAS' && (
                <Button
                  onClick={() => handleProcess(order.id)}
                  disabled={processingId === order.id}
                >
                  {processingId === order.id ? 'Memproses...' : 'Proses Pesanan'}
                </Button>
              )}
            </div>

            {rowErrors[order.id] && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {rowErrors[order.id]}
              </p>
            )}

            {expanded && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <OrderStatusTimeline statusHistory={order.statusHistory} currentStatus={order.currentStatus} />
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
