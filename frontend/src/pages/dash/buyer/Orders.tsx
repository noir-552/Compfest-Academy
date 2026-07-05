import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import * as buyerApi from '../../../api/buyer';
import { formatRupiah } from '../../../lib/format';
import { Card } from '../../../ui/Card';
import { EmptyState } from '../../../ui/EmptyState';
import { SkeletonList } from '../../../ui/Skeleton';
import { StatusPill } from '../../../ui/StatusPill';

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

      {loading && <SkeletonList rows={3} />}
      {error && (
        <Card>
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        </Card>
      )}
      {!loading && !error && orders.length === 0 && (
        <Card>
          <EmptyState
            heading="Belum ada pesanan"
            teachLine="Pesananmu akan muncul di sini setelah kamu check-out dari keranjang."
            action={
              <Link to="/catalog" className="text-sm font-medium text-teal-700">
                Jelajahi katalog →
              </Link>
            }
          />
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
                    <p className="tabular text-sm font-semibold text-slate-900">{formatRupiah(order.finalTotal)}</p>
                    <StatusPill status={order.currentStatus} />
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
