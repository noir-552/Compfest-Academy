import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import * as buyerApi from '../../../api/buyer';
import { formatRupiah } from '../../../lib/format';
import { Badge } from '../../../ui/Badge';
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

export function Orders() {
  const [orders, setOrders] = useState<buyerApi.OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    buyerApi
      .listOrders()
      .then((res) => setOrders(res.orders))
      .catch(() => setError('Gagal memuat pesanan.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900">Pesanan</h1>

      {loading && (
        <Card>
          <p className="text-sm text-slate-500">Memuat pesanan...</p>
        </Card>
      )}
      {error && (
        <Card>
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        </Card>
      )}
      {!loading && !error && orders.length === 0 && (
        <Card>
          <p className="text-sm text-slate-500">Belum ada pesanan.</p>
        </Card>
      )}

      {!loading && !error && orders.length > 0 && (
        <div className="flex flex-col gap-3">
          {orders.map((order) => (
            <Link key={order.id} to={`/dashboard/buyer/orders/${order.id}`}>
              <Card className="transition hover:border-teal-300">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Pesanan #{order.id.slice(0, 8)}</p>
                    <p className="text-xs text-slate-500">{formatDate(order.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold text-slate-900">{formatRupiah(order.finalTotal)}</p>
                    <Badge tone={statusTone(order.currentStatus)}>
                      {STATUS_LABEL[order.currentStatus] ?? order.currentStatus}
                    </Badge>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
