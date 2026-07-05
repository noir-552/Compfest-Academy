import { useState, type FormEvent } from 'react';
import * as adminApi from '../../../api/admin';
import { ApiClientError } from '../../../api/client';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';

export interface VoucherFormProps {
  onCreated: (voucher: adminApi.Voucher) => void;
}

/** Generates a new voucher: code + PERCENT/FIXED value + usage quota + expiry date. */
export function VoucherForm({ onCreated }: VoucherFormProps) {
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [discountValue, setDiscountValue] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const value = Number(discountValue);
    const limit = Number(usageLimit);
    if (!code.trim()) {
      setError('Kode voucher wajib diisi.');
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      setError('Nilai diskon harus lebih dari 0.');
      return;
    }
    if (!Number.isFinite(limit) || limit < 1) {
      setError('Kuota penggunaan minimal 1.');
      return;
    }
    if (!expiryDate) {
      setError('Tanggal kedaluwarsa wajib diisi.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await adminApi.createVoucher({
        code: code.trim().toUpperCase(),
        discountType,
        discountValue: value,
        usageLimit: limit,
        expiryDate: new Date(expiryDate).toISOString(),
      });
      onCreated(res.voucher);
      setCode('');
      setDiscountValue('');
      setUsageLimit('');
      setExpiryDate('');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Gagal membuat voucher.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <Input
        label="Kode Voucher"
        name="voucherCode"
        required
        maxLength={20}
        placeholder="HEMAT10"
        value={code}
        onChange={(event) => setCode(event.target.value.toUpperCase())}
      />
      <div className="flex flex-col gap-1">
        <label htmlFor="voucherType" className="text-sm font-medium text-slate-700">
          Tipe Diskon
        </label>
        <select
          id="voucherType"
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
        name="voucherValue"
        type="number"
        min={1}
        max={discountType === 'PERCENT' ? 100 : undefined}
        required
        value={discountValue}
        onChange={(event) => setDiscountValue(event.target.value)}
      />
      <Input
        label="Kuota Penggunaan"
        name="voucherUsageLimit"
        type="number"
        min={1}
        required
        value={usageLimit}
        onChange={(event) => setUsageLimit(event.target.value)}
      />
      <Input
        label="Tanggal Kedaluwarsa"
        name="voucherExpiryDate"
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
          {submitting ? 'Membuat...' : 'Buat Voucher'}
        </Button>
      </div>
    </form>
  );
}
