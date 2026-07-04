import { useState } from 'react';
import * as discountsApi from '../api/discounts';
import { ApiClientError } from '../api/client';
import { formatRupiah } from '../lib/format';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export interface DiscountCodeFieldProps {
  /** Input id/name, used to associate the label for accessibility/testing. */
  id: string;
  /** Field label, e.g. "Kode Voucher" / "Kode Promo". */
  label: string;
  /** The validated code currently applied to this field, if any. */
  applied: discountsApi.DiscountValidation | null;
  /** Cart subtotal used for validation; Terapkan is disabled while unknown. */
  subtotal: number | null;
  disabled?: boolean;
  onApply: (result: discountsApi.DiscountValidation) => void;
  onRemove: () => void;
}

const KIND_LABEL: Record<discountsApi.DiscountKind, string> = {
  VOUCHER: 'Voucher',
  PROMO: 'Promo',
};

const KIND_BADGE_TONE: Record<discountsApi.DiscountKind, 'success' | 'info'> = {
  VOUCHER: 'success',
  PROMO: 'info',
};

const KIND_CONTAINER_CLASS: Record<discountsApi.DiscountKind, string> = {
  VOUCHER: 'border-emerald-200 bg-emerald-50',
  PROMO: 'border-teal-200 bg-teal-50',
};

const KIND_AMOUNT_CLASS: Record<discountsApi.DiscountKind, string> = {
  VOUCHER: 'text-emerald-700',
  PROMO: 'text-teal-700',
};

/**
 * A single discount-code input with its own "Terapkan" (apply) button and
 * inline validation state. Once a code is applied, renders a kind-tagged
 * summary (distinct styling for VOUCHER vs PROMO) with a "Hapus" (remove)
 * button instead of the input. Validation errors (404 DISCOUNT_NOT_FOUND,
 * 409 DISCOUNT_EXPIRED/DISCOUNT_EXHAUSTED) surface inline using the
 * backend's own message.
 */
export function DiscountCodeField({ id, label, applied, subtotal, disabled, onApply, onRemove }: DiscountCodeFieldProps) {
  const [code, setCode] = useState('');
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApply() {
    const trimmed = code.trim();
    if (!trimmed || subtotal === null) return;
    setValidating(true);
    setError(null);
    try {
      const result = await discountsApi.validateDiscountCode(trimmed, subtotal);
      onApply(result);
      setCode('');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Gagal memvalidasi kode.');
    } finally {
      setValidating(false);
    }
  }

  function handleRemove() {
    setCode('');
    setError(null);
    onRemove();
  }

  if (applied) {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <div
          className={`flex items-center justify-between rounded-lg border p-3 text-sm ${KIND_CONTAINER_CLASS[applied.kind]}`}
        >
          <div className="flex items-center gap-2">
            <Badge tone={KIND_BADGE_TONE[applied.kind]}>{KIND_LABEL[applied.kind]}</Badge>
            <span className="font-semibold text-slate-900">{applied.code}</span>
            <span className={KIND_AMOUNT_CLASS[applied.kind]}>-{formatRupiah(applied.amount)}</span>
          </div>
          <Button variant="ghost" onClick={handleRemove} disabled={disabled}>
            Hapus
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            id={id}
            name={id}
            label={label}
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            disabled={disabled || validating}
            placeholder="Masukkan kode"
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={handleApply}
          disabled={disabled || validating || !code.trim() || subtotal === null}
        >
          {validating ? 'Memeriksa...' : 'Terapkan'}
        </Button>
      </div>
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
