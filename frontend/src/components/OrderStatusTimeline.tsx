export interface OrderStatusHistoryEntry {
  status: string;
  changedByRole: string;
  changedAt: string;
}

export interface OrderStatusTimelineProps {
  statusHistory: OrderStatusHistoryEntry[];
  currentStatus: string;
}

const MAIN_FLOW = ['SEDANG_DIKEMAS', 'MENUNGGU_PENGIRIM', 'SEDANG_DIKIRIM', 'PESANAN_SELESAI'] as const;

const STATUS_LABEL: Record<string, string> = {
  SEDANG_DIKEMAS: 'Sedang Dikemas',
  MENUNGGU_PENGIRIM: 'Menunggu Pengirim',
  SEDANG_DIKIRIM: 'Sedang Dikirim',
  PESANAN_SELESAI: 'Pesanan Selesai',
  DIKEMBALIKAN: 'Dikembalikan',
};

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

function StatusStep({
  status,
  entry,
  isCurrent,
  tone = 'default',
}: {
  status: string;
  entry: OrderStatusHistoryEntry | undefined;
  isCurrent: boolean;
  tone?: 'default' | 'danger';
}) {
  const done = Boolean(entry);
  const dotClass = tone === 'danger' ? (done ? 'bg-red-500' : 'bg-slate-200') : done ? 'bg-teal-600' : 'bg-slate-200';
  const labelClass = isCurrent
    ? tone === 'danger'
      ? 'text-red-700'
      : 'text-teal-700'
    : done
      ? 'text-slate-900'
      : 'text-slate-400';

  return (
    <li className="flex items-start gap-3">
      <span
        className={`mt-1 h-3 w-3 flex-shrink-0 rounded-full ${dotClass} ${isCurrent ? 'ring-4 ring-teal-100' : ''}`}
        aria-hidden="true"
      />
      <div>
        <p className={`text-sm font-medium ${labelClass}`} aria-current={isCurrent ? 'step' : undefined}>
          {STATUS_LABEL[status] ?? status}
        </p>
        {entry && <p className="text-xs text-slate-500">{formatTimestamp(entry.changedAt)}</p>}
      </div>
    </li>
  );
}

/**
 * Renders the main order flow (Sedang Dikemas → Menunggu Pengirim → Sedang
 * Dikirim → Pesanan Selesai) from `statusHistory`, highlighting whichever
 * step matches `currentStatus`. If the order was returned, an extra
 * "Dikembalikan" branch step is appended and highlighted instead.
 */
export function OrderStatusTimeline({ statusHistory, currentStatus }: OrderStatusTimelineProps) {
  const entryByStatus = new Map(statusHistory.map((entry) => [entry.status, entry]));
  const isReturned = currentStatus === 'DIKEMBALIKAN' || entryByStatus.has('DIKEMBALIKAN');

  return (
    <ol className="flex flex-col gap-4">
      {MAIN_FLOW.map((status) => (
        <StatusStep key={status} status={status} entry={entryByStatus.get(status)} isCurrent={status === currentStatus} />
      ))}
      {isReturned && (
        <StatusStep
          status="DIKEMBALIKAN"
          entry={entryByStatus.get('DIKEMBALIKAN')}
          isCurrent={currentStatus === 'DIKEMBALIKAN'}
          tone="danger"
        />
      )}
    </ol>
  );
}
