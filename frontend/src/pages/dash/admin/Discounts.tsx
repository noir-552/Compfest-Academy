import { useEffect, useState } from 'react';
import * as adminApi from '../../../api/admin';
import { formatRupiah } from '../../../lib/format';
import { Badge } from '../../../ui/Badge';
import { Card } from '../../../ui/Card';
import { Modal } from '../../../ui/Modal';
import { PromoForm } from './PromoForm';
import { VoucherForm } from './VoucherForm';

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('id-ID', { dateStyle: 'medium' });
}

function discountValueLabel(type: string, value: number): string {
  return type === 'PERCENT' ? `${value}%` : formatRupiah(value);
}

type DetailState = { kind: 'VOUCHER'; item: adminApi.Voucher } | { kind: 'PROMO'; item: adminApi.Promo } | null;

/** Admin voucher + promo management: generate forms, lists with expiry/usage columns, and a shared detail modal. */
export function Discounts() {
  const [vouchers, setVouchers] = useState<adminApi.Voucher[]>([]);
  const [promos, setPromos] = useState<adminApi.Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailState>(null);

  function reload() {
    setLoading(true);
    setError(null);
    Promise.all([adminApi.listVouchers(), adminApi.listPromos()])
      .then(([voucherRes, promoRes]) => {
        setVouchers(voucherRes.vouchers);
        setPromos(promoRes.promos);
      })
      .catch(() => setError('Gagal memuat voucher/promo.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900">Voucher &amp; Promo</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Buat Voucher</h2>
          <VoucherForm
            onCreated={(voucher) => setVouchers((prev) => [voucher, ...prev])}
          />
        </Card>
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Buat Promo</h2>
          <PromoForm onCreated={(promo) => setPromos((prev) => [promo, ...prev])} />
        </Card>
      </div>

      {error && (
        <Card>
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Daftar Voucher</h2>
        {loading ? (
          <p className="text-sm text-slate-500">Memuat voucher...</p>
        ) : (
          <div className="flex flex-col gap-2">
            {vouchers.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">Belum ada voucher.</p>
            ) : (
              vouchers.map((voucher) => (
                <button
                  key={voucher.id}
                  type="button"
                  className="w-full text-left"
                  onClick={() => setDetail({ kind: 'VOUCHER', item: voucher })}
                >
                  <div className="grid grid-cols-4 items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm hover:border-teal-300 hover:bg-teal-50/50">
                    <span className="font-medium text-slate-900">{voucher.code}</span>
                    <span>{discountValueLabel(voucher.discountType, voucher.discountValue)}</span>
                    <span>
                      {voucher.usageRemaining}/{voucher.usageLimit}
                    </span>
                    <span className="text-slate-500">{formatDate(voucher.expiryDate)}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Daftar Promo</h2>
        {loading ? (
          <p className="text-sm text-slate-500">Memuat promo...</p>
        ) : (
          <div className="flex flex-col gap-2">
            {promos.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">Belum ada promo.</p>
            ) : (
              promos.map((promo) => (
                <button
                  key={promo.id}
                  type="button"
                  className="w-full text-left"
                  onClick={() => setDetail({ kind: 'PROMO', item: promo })}
                >
                  <div className="grid grid-cols-3 items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm hover:border-teal-300 hover:bg-teal-50/50">
                    <span className="font-medium text-slate-900">{promo.code}</span>
                    <span>{discountValueLabel(promo.discountType, promo.discountValue)}</span>
                    <span className="text-slate-500">{formatDate(promo.expiryDate)}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </Card>

      <Modal
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail?.kind === 'VOUCHER' ? 'Detail Voucher' : 'Detail Promo'}
      >
        {detail && (
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Kode</dt>
              <dd className="font-semibold text-slate-900">{detail.item.code}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Tipe</dt>
              <dd>
                <Badge tone="info">{detail.item.discountType}</Badge>
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Nilai</dt>
              <dd className="font-medium text-slate-900">
                {discountValueLabel(detail.item.discountType, detail.item.discountValue)}
              </dd>
            </div>
            {detail.kind === 'VOUCHER' && (
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Kuota</dt>
                <dd className="font-medium text-slate-900">
                  {detail.item.usageRemaining}/{detail.item.usageLimit} tersisa
                </dd>
              </div>
            )}
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Kedaluwarsa</dt>
              <dd className="font-medium text-slate-900">{formatDate(detail.item.expiryDate)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Dibuat</dt>
              <dd className="font-medium text-slate-900">{formatDate(detail.item.createdAt)}</dd>
            </div>
          </dl>
        )}
      </Modal>
    </div>
  );
}
