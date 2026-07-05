import { useState, type FormEvent } from 'react';
import * as adminApi from '../../../api/admin';
import { ApiClientError } from '../../../api/client';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';

export interface PromoFormProps {
  onCreated: (promo: adminApi.Promo) => void;
}

/** Generates a new promo: code + PERCENT/FIXED value + expiry date (no usage quota, unlike vouchers). */
export function PromoForm({ onCreated }: PromoFormProps) {
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [discountValue, setDiscountValue] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const value = Number(discountValue);
    if (!code.trim()) {
      setError('Kode promo wajib diisi.');
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      setError('Nilai diskon harus lebih dari 0.');
      return;
    }
    if (!expiryDate) {
      setError('Tanggal kedaluwarsa wajib diisi.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await adminApi.createPromo({
        code: code.trim().toUpperCase(),
        discountType,
        discountValue: value,
        expiryDate: new Date(expiryDate).toISOString(),
      });
      onCreated(res.promo);
      setCode('');
      setDiscountValue('');
      setExpiryDate('');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Gagal membuat promo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <Input
        label="Kode Promo"
        name="promoCode"
        required
        maxLength={20}
        placeholder="PROMOAKHIR"
        value={code}
        onChange={(event) => setCode(event.target.value.toUpperCase())}
      />
      <div className="flex flex-col gap-1">
        <label htmlFor="promoType" className="text-sm font-medium text-slate-700">
          Tipe Diskon
        </label>
        <select
          id="promoType"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          value={discountType}
          onChange={(event) => setDiscountType(event.target.value as 'PERCENT' | 'FIXED')}
        >
          <option value="PERCENT">Persentase (%)</option>
          <option value="FIXED">Nominal Tetap (Rp)</option>
        </select>
      </div>
      <Input
        label={discountType === 'PERCENT' ? 'Nilai Diskon (1-100)' : 'Nilai Diskon (Rp)'}
        name="promoValue"
        type="number"
        min={1}
        max={discountType === 'PERCENT' ? 100 : undefined}
        required
        value={discountValue}
        onChange={(event) => setDiscountValue(event.target.value)}
      />
      <Input
        label="Tanggal Kedaluwarsa"
        name="promoExpiryDate"
        type="date"
        required
        value={expiryDate}
        onChange={(event) => setExpiryDate(event.target.value)}
      />
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Membuat...' : 'Buat Promo'}
        </Button>
      </div>
    </form>
  );
}
