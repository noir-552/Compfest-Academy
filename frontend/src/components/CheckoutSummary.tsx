import { formatRupiah } from '../lib/format';

export interface CheckoutSummaryProps {
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  ppnAmount: number;
  finalTotal: number;
}

function Row({ label, value, emphasis = false }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between text-sm ${
        emphasis ? 'font-semibold text-slate-900' : 'text-slate-600'
      }`}
    >
      <span>{label}</span>
      <span className="tabular">{formatRupiah(value)}</span>
    </div>
  );
}

/** Renders the standard checkout totals breakdown: subtotal, discount, delivery fee, PPN 12%, and final total. */
export function CheckoutSummary({ subtotal, discountAmount, deliveryFee, ppnAmount, finalTotal }: CheckoutSummaryProps) {
  return (
    <div className="flex flex-col gap-2">
      <Row label="Subtotal" value={subtotal} />
      <Row label="Diskon" value={discountAmount} />
      <Row label="Ongkir" value={deliveryFee} />
      <Row label="PPN 12%" value={ppnAmount} />
      <hr className="border-slate-200" />
      <Row label="Total" value={finalTotal} emphasis />
    </div>
  );
}
