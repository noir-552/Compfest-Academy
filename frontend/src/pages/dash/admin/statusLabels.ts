// Shared status label/tone lookups for the admin dashboard's Jobs page —
// order-lifecycle statuses now live in src/lib/orderStatus.ts + StatusPill
// (the shared status system used across buyer/seller/admin surfaces).

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'info';

export const JOB_STATUS_LABEL: Record<string, string> = {
  AVAILABLE: 'Tersedia',
  TAKEN: 'Diambil',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
};

export function jobStatusTone(status: string): BadgeTone {
  if (status === 'COMPLETED') return 'success';
  if (status === 'CANCELLED') return 'warning';
  if (status === 'TAKEN') return 'info';
  return 'neutral';
}
