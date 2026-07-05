import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import * as buyerApi from '../../../api/buyer';
import { CheckoutSummary } from '../../../components/CheckoutSummary';
import { OrderStatusTimeline } from '../../../components/OrderStatusTimeline';
import { formatRupiah } from '../../../lib/format';
import { Card } from '../../../ui/Card';

export function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<buyerApi.OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotFound(false);
    buyerApi
      .getOrder(id)
      .then((res) => setOrder(res.order))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <Card>
        <p className="text-sm text-slate-500">Memuat pesanan...</p>
      </Card>
    );
  }

  if (notFound || !order) {
    return (
      <Card>
        <p className="text-sm text-slate-900">Pesanan tidak ditemukan.</p>
        <Link to="/dashboard/buyer/orders" className="mt-2 inline-block text-sm font-medium text-teal-700">
          ← Kembali ke pesanan
        </Link>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/dashboard/buyer/orders" className="text-sm font-medium text-teal-700">
          ← Kembali ke pesanan
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Pesanan #{order.id.slice(0, 8)}</h1>
      </div>

      <Card title="Status pesanan">
        <OrderStatusTimeline statusHistory={order.statusHistory} currentStatus={order.currentStatus} />
      </Card>

      <Card title="Alamat pengiriman">
        <p className="text-sm font-medium text-slate-900">{order.recipientNameSnapshot}</p>
        <p className="text-sm text-slate-600">{order.phoneSnapshot}</p>
        <p className="mt-1 text-sm text-slate-500">{order.fullAddressSnapshot}</p>
      </Card>

      <Card title="Item pesanan">
        <div className="flex flex-col gap-3">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between text-sm">
              <div>
                <p className="font-medium text-slate-900">{item.productNameSnapshot}</p>
                <p className="tabular text-slate-500">
                  {item.quantity} × {formatRupiah(item.priceSnapshot)}
                </p>
              </div>
              <p className="tabular font-semibold text-slate-900">
                {formatRupiah(item.priceSnapshot * item.quantity)}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Rincian pembayaran">
        <CheckoutSummary
          subtotal={order.subtotal}
          discountAmount={order.discountAmount}
          deliveryFee={order.deliveryFee}
          ppnAmount={order.ppnAmount}
          finalTotal={order.finalTotal}
        />
      </Card>
    </div>
  );
}
