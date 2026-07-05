// Shared order-lifecycle status system (DESIGN.md "Status color system").
// The five states get one fixed visual language everywhere they appear:
// buyer Orders/OrderDetail, seller IncomingOrders, admin Orders/Overview/Overdue,
// and OrderStatusTimeline. Distinguishable beyond hue — a dot AND an
// Indonesian label are always present, never color alone.

export type OrderStatusCode =
  | 'SEDANG_DIKEMAS'
  | 'MENUNGGU_PENGIRIM'
  | 'SEDANG_DIKIRIM'
  | 'PESANAN_SELESAI'
  | 'DIKEMBALIKAN';

export interface OrderStatusMeta {
  /** Indonesian label shown next to the dot. */
  label: string;
  /** Semantic tone name (also usable as a Badge tone). */
  tone: 'amber' | 'violet' | 'sky' | 'emerald' | 'rose';
  /** Solid dot color. */
  dotClass: string;
  /** Tint background for pill/badge surfaces. */
  tintClass: string;
  /** Readable text color against the tint background. */
  textClass: string;
}

export const ORDER_STATUS_FLOW: OrderStatusCode[] = [
  'SEDANG_DIKEMAS',
  'MENUNGGU_PENGIRIM',
  'SEDANG_DIKIRIM',
  'PESANAN_SELESAI',
];

export const ORDER_STATUS: Record<OrderStatusCode, OrderStatusMeta> = {
  SEDANG_DIKEMAS: {
    label: 'Sedang Dikemas',
    tone: 'amber',
    dotClass: 'bg-amber-500',
    tintClass: 'bg-amber-50',
    textClass: 'text-amber-800',
  },
  MENUNGGU_PENGIRIM: {
    label: 'Menunggu Pengirim',
    tone: 'violet',
    dotClass: 'bg-violet-500',
    tintClass: 'bg-violet-50',
    textClass: 'text-violet-800',
  },
  SEDANG_DIKIRIM: {
    label: 'Sedang Dikirim',
    tone: 'sky',
    dotClass: 'bg-sky-500',
    tintClass: 'bg-sky-50',
    textClass: 'text-sky-800',
  },
  PESANAN_SELESAI: {
    label: 'Pesanan Selesai',
    tone: 'emerald',
    dotClass: 'bg-emerald-500',
    tintClass: 'bg-emerald-50',
    textClass: 'text-emerald-800',
  },
  DIKEMBALIKAN: {
    label: 'Dikembalikan',
    tone: 'rose',
    dotClass: 'bg-rose-500',
    tintClass: 'bg-rose-50',
    textClass: 'text-rose-800',
  },
};

const FALLBACK_META: OrderStatusMeta = {
  label: '',
  tone: 'amber',
  dotClass: 'bg-slate-400',
  tintClass: 'bg-slate-100',
  textClass: 'text-slate-700',
};

/** Looks up status metadata, falling back to a neutral tone + the raw code as label for unknown values. */
export function orderStatusMeta(status: string): OrderStatusMeta {
  const meta = ORDER_STATUS[status as OrderStatusCode];
  if (meta) return meta;
  return { ...FALLBACK_META, label: status };
}
