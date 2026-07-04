import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import * as buyerApi from '../../../api/buyer';
import type { DiscountValidation } from '../../../api/discounts';
import { ApiClientError } from '../../../api/client';
import { useCart } from '../../../cart/CartContext';
import { CheckoutSummary } from '../../../components/CheckoutSummary';
import { DiscountCodeField } from '../../../components/DiscountCodeField';
import { Badge } from '../../../ui/Badge';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Card';
import { formatRupiah } from '../../../lib/format';

const DELIVERY_METHODS: buyerApi.DeliveryMethod[] = ['INSTANT', 'NEXT_DAY', 'REGULAR'];

export function Checkout() {
  const [addresses, setAddresses] = useState<buyerApi.Address[]>([]);
  const [addressId, setAddressId] = useState<string>('');
  const [deliveryMethod, setDeliveryMethod] = useState<buyerApi.DeliveryMethod>('REGULAR');
  const [preview, setPreview] = useState<buyerApi.CheckoutPreview | null>(null);
  const [voucherApplied, setVoucherApplied] = useState<DiscountValidation | null>(null);
  const [promoApplied, setPromoApplied] = useState<DiscountValidation | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const { refreshCart } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    buyerApi
      .listAddresses()
      .then((res) => {
        setAddresses(res.addresses);
        const defaultAddress = res.addresses.find((a) => a.isDefault) ?? res.addresses[0];
        if (defaultAddress) setAddressId(defaultAddress.id);
      })
      .catch(() => setLoadError('Gagal memuat alamat.'))
      .finally(() => setLoading(false));
  }, []);

  const voucherCode = voucherApplied?.code;
  const promoCode = promoApplied?.code;

  useEffect(() => {
    if (!addressId) return;
    let ignored = false;
    setPreviewLoading(true);
    setPreviewError(null);
    buyerApi
      .previewCheckout({
        addressId,
        deliveryMethod,
        ...(voucherCode ? { voucherCode } : {}),
        ...(promoCode ? { promoCode } : {}),
      })
      .then((res) => {
        if (!ignored) setPreview(res);
      })
      .catch((err) => {
        if (!ignored) {
          setPreview(null);
          setPreviewError(err instanceof ApiClientError ? err.message : 'Gagal memuat ringkasan checkout.');
        }
      })
      .finally(() => {
        if (!ignored) setPreviewLoading(false);
      });
    return () => {
      ignored = true;
    };
  }, [addressId, deliveryMethod, voucherCode, promoCode]);

  async function handlePay() {
    if (!addressId) return;
    setPaying(true);
    setPayError(null);
    try {
      const res = await buyerApi.checkout({
        addressId,
        deliveryMethod,
        ...(voucherCode ? { voucherCode } : {}),
        ...(promoCode ? { promoCode } : {}),
      });
      refreshCart();
      navigate(`/dashboard/buyer/orders/${res.order.id}`);
    } catch (err) {
      setPayError(err instanceof ApiClientError ? err.message : 'Gagal memproses pembayaran.');
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <p className="text-sm text-slate-500">Memuat checkout...</p>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card>
        <p className="text-sm text-red-600" role="alert">
          {loadError}
        </p>
      </Card>
    );
  }

  if (addresses.length === 0) {
    return (
      <Card>
        <p className="text-sm text-slate-500">
          Kamu belum punya alamat.{' '}
          <Link to="/dashboard/buyer/addresses" className="font-medium text-teal-700">
            Tambah alamat
          </Link>{' '}
          dulu sebelum checkout.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900">Checkout</h1>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Alamat pengiriman</h2>
        <div className="flex flex-col gap-2">
          {addresses.map((address) => (
            <label
              key={address.id}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${
                addressId === address.id ? 'border-teal-600 bg-teal-50' : 'border-slate-200'
              }`}
            >
              <input
                type="radio"
                name="addressId"
                className="mt-1"
                checked={addressId === address.id}
                onChange={() => setAddressId(address.id)}
              />
              <span>
                <span className="font-semibold text-slate-900">{address.label}</span>
                <span className="block text-slate-600">
                  {address.recipientName} · {address.phone}
                </span>
                <span className="block text-slate-500">{address.fullAddress}</span>
              </span>
            </label>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Metode pengiriman</h2>
        <div className="flex flex-col gap-2">
          {DELIVERY_METHODS.map((method) => (
            <label
              key={method}
              className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 text-sm ${
                deliveryMethod === method ? 'border-teal-600 bg-teal-50' : 'border-slate-200'
              }`}
            >
              <span className="flex items-center gap-3">
                <input
                  type="radio"
                  name="deliveryMethod"
                  checked={deliveryMethod === method}
                  onChange={() => setDeliveryMethod(method)}
                />
                {buyerApi.DELIVERY_METHOD_LABEL[method]}
              </span>
              <span className="text-slate-500">Rp{buyerApi.DELIVERY_FEES[method].toLocaleString('id-ID')}</span>
            </label>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Kode diskon</h2>
        <div className="flex flex-col gap-4">
          <DiscountCodeField
            id="voucher-code"
            label="Kode Voucher"
            applied={voucherApplied}
            subtotal={preview?.totals.subtotal ?? null}
            disabled={paying}
            onApply={setVoucherApplied}
            onRemove={() => setVoucherApplied(null)}
          />
          <DiscountCodeField
            id="promo-code"
            label="Kode Promo"
            applied={promoApplied}
            subtotal={preview?.totals.subtotal ?? null}
            disabled={paying}
            onApply={setPromoApplied}
            onRemove={() => setPromoApplied(null)}
          />
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Ringkasan</h2>
        {previewLoading && <p className="text-sm text-slate-500">Memuat ringkasan...</p>}
        {previewError && (
          <p className="text-sm text-red-600" role="alert">
            {previewError}
          </p>
        )}
        {!previewLoading && !previewError && preview && (preview.discounts.voucher || preview.discounts.promo) && (
          <div className="mb-3 flex flex-col gap-1.5 rounded-lg bg-slate-50 p-3">
            {preview.discounts.voucher && (
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Badge tone="success">Voucher</Badge>
                  <span className="text-slate-700">{preview.discounts.voucher.code}</span>
                </span>
                <span className="text-emerald-700">-{formatRupiah(preview.discounts.voucher.amount)}</span>
              </div>
            )}
            {preview.discounts.promo && (
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Badge tone="info">Promo</Badge>
                  <span className="text-slate-700">{preview.discounts.promo.code}</span>
                </span>
                <span className="text-teal-700">-{formatRupiah(preview.discounts.promo.amount)}</span>
              </div>
            )}
          </div>
        )}
        {!previewLoading && !previewError && preview && (
          <CheckoutSummary
            subtotal={preview.totals.subtotal}
            discountAmount={preview.totals.discountAmount}
            deliveryFee={preview.totals.deliveryFee}
            ppnAmount={preview.totals.ppnAmount}
            finalTotal={preview.totals.finalTotal}
          />
        )}
        {payError && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {payError}
          </p>
        )}
        <div className="mt-4 flex justify-end">
          <Button onClick={handlePay} disabled={paying || previewLoading || !preview}>
            {paying ? 'Memproses...' : 'Bayar'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
