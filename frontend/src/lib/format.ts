/** Formats an integer rupiah amount as `Rp75.000` (id-ID thousands separators, no decimals). */
export function formatRupiah(amount: number): string {
  return `Rp${amount.toLocaleString('id-ID')}`;
}
