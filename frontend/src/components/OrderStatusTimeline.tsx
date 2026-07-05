import { ORDER_STATUS_FLOW, orderStatusMeta, type OrderStatusCode } from '../lib/orderStatus';

export interface OrderStatusHistoryEntry {
  status: string;
  changedByRole: string;
  changedAt: string;
}

export interface OrderStatusTimelineProps {
  statusHistory: OrderStatusHistoryEntry[];
  currentStatus: string;
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

interface StepInfo {
  status: OrderStatusCode;
  entry: OrderStatusHistoryEntry | undefined;
  done: boolean;
  isCurrent: boolean;
}

/**
 * The signature order-lifecycle component (DESIGN.md — "the hero"). Renders
 * the main flow (Sedang Dikemas → Menunggu Pengirim → Sedang Dikirim →
 * Pesanan Selesai) as a horizontal stepper on desktop and a vertical list on
 * mobile, with a connector line, checked/done steps, a pulsing current step,
 * and muted upcoming steps. If the order was returned, a rose "Dikembalikan"
 * node renders as a terminal branch off the main path instead of the next
 * upcoming step. Reduced-motion safe (pulse is disabled globally via
 * `prefers-reduced-motion` in index.css).
 */
export function OrderStatusTimeline({ statusHistory, currentStatus }: OrderStatusTimelineProps) {
  const entryByStatus = new Map(statusHistory.map((entry) => [entry.status, entry]));
  const isReturned = currentStatus === 'DIKEMBALIKAN' || entryByStatus.has('DIKEMBALIKAN');
  const currentIndex = ORDER_STATUS_FLOW.indexOf(currentStatus as OrderStatusCode);

  const steps: StepInfo[] = ORDER_STATUS_FLOW.map((status, index) => ({
    status,
    entry: entryByStatus.get(status),
    done: Boolean(entryByStatus.get(status)) || (isReturned && index <= currentIndex),
    isCurrent: status === currentStatus,
  }));

  const returnedEntry = entryByStatus.get('DIKEMBALIKAN');

  return (
    <div className="w-full">
      {/* Desktop: horizontal stepper */}
      <ol className="hidden md:flex md:items-start">
        {steps.map((step, index) => (
          <li key={step.status} className="flex flex-1 items-start last:flex-none">
            <div className="flex flex-col items-center">
              <StepDot done={step.done} isCurrent={step.isCurrent} />
              <div className="mt-2 w-28 text-center">
                <StepLabel status={step.status} isCurrent={step.isCurrent} done={step.done} />
                {step.entry && <StepTimestamp value={step.entry.changedAt} />}
              </div>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`mt-2.5 h-0.5 flex-1 rounded-full ${step.done ? 'bg-teal-600' : 'bg-slate-200'}`}
                aria-hidden="true"
              />
            )}
          </li>
        ))}
        {isReturned && (
          <li className="flex items-start">
            <div className="mt-2.5 mr-1 h-0.5 w-6 rounded-full bg-rose-400" aria-hidden="true" />
            <div className="flex flex-col items-center">
              <StepDot done tone="danger" isCurrent={currentStatus === 'DIKEMBALIKAN'} />
              <div className="mt-2 w-28 text-center">
                <p className="text-sm font-medium text-rose-700" aria-current={currentStatus === 'DIKEMBALIKAN' ? 'step' : undefined}>
                  Dikembalikan
                </p>
                {returnedEntry && <StepTimestamp value={returnedEntry.changedAt} />}
              </div>
            </div>
          </li>
        )}
      </ol>

      {/* Mobile: vertical list */}
      <ol className="flex flex-col gap-4 md:hidden">
        {steps.map((step) => (
          <li key={step.status} className="flex items-start gap-3">
            <StepDot done={step.done} isCurrent={step.isCurrent} />
            <div>
              <StepLabel status={step.status} isCurrent={step.isCurrent} done={step.done} />
              {step.entry && <StepTimestamp value={step.entry.changedAt} />}
            </div>
          </li>
        ))}
        {isReturned && (
          <li className="flex items-start gap-3">
            <StepDot done tone="danger" isCurrent={currentStatus === 'DIKEMBALIKAN'} />
            <div>
              <p className="text-sm font-medium text-rose-700" aria-current={currentStatus === 'DIKEMBALIKAN' ? 'step' : undefined}>
                Dikembalikan
              </p>
              {returnedEntry && <StepTimestamp value={returnedEntry.changedAt} />}
            </div>
          </li>
        )}
      </ol>
    </div>
  );
}

function StepDot({
  done,
  isCurrent,
  tone = 'default',
}: {
  done: boolean;
  isCurrent: boolean;
  tone?: 'default' | 'danger';
}) {
  const base = tone === 'danger' ? 'bg-rose-500' : done ? 'bg-teal-600' : 'bg-slate-200';
  return (
    <span className="relative flex h-4 w-4 flex-shrink-0 items-center justify-center" aria-hidden="true">
      {isCurrent && (
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${tone === 'danger' ? 'bg-rose-400' : 'bg-teal-400'}`}
        />
      )}
      <span className={`relative inline-flex h-3 w-3 rounded-full ${base} ${isCurrent ? 'ring-4 ring-teal-100' : ''}`}>
        {done && !isCurrent && (
          <svg viewBox="0 0 16 16" className="h-3 w-3 text-white" fill="none" aria-hidden="true">
            <path d="M4 8.5l2.5 2.5L12 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </span>
  );
}

function StepLabel({ status, isCurrent, done }: { status: OrderStatusCode; isCurrent: boolean; done: boolean }) {
  const meta = orderStatusMeta(status);
  const labelClass = isCurrent ? 'text-teal-700' : done ? 'text-slate-900' : 'text-slate-400';
  return (
    <p className={`text-sm font-medium ${labelClass}`} aria-current={isCurrent ? 'step' : undefined}>
      {meta.label}
    </p>
  );
}

function StepTimestamp({ value }: { value: string }) {
  return <p className="tabular text-xs text-slate-500">{formatTimestamp(value)}</p>;
}
