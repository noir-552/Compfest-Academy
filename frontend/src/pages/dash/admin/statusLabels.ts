// Shared status label/tone lookups for the admin dashboard's Overview, Orders,
// Jobs, and Overdue pages — keeps the Indonesian labels and badge colors for
// order/delivery-job statuses in one place.

export const ORDER_STATUS_LABEL: Record<string, string> = {
  SEDANG_DIKEMAS: 'Sedang Dikemas',
  MENUNGGU_PENGIRIM: 'Menunggu Pengirim',
  SEDANG_DIKIRIM: 'Sedang Dikirim',
  PESANAN_SELESAI: 'Pesanan Selesai',
  DIKEMBALIKAN: 'Dikembalikan',
};

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'info';

export function orderStatusTone(status: string): BadgeTone {
  if (status === 'PESANAN_SELESAI') return 'success';
  if (status === 'DIKEMBALIKAN') return 'warning';
  return 'info';
}

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
