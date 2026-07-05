import { orderStatusMeta } from '../lib/orderStatus';

export interface StatusPillProps {
  status: string;
  className?: string;
}

/**
 * The order-lifecycle status badge (DESIGN.md "Status color system" — the
 * hero). Always renders a colored dot AND the Indonesian label together so
 * the state reads beyond hue alone. Use this instead of ad-hoc Badge +
 * label-map pairs wherever an order status is shown.
 */
export function StatusPill({ status, className = '' }: StatusPillProps) {
  const meta = orderStatusMeta(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.tintClass} ${meta.textClass} ${className}`}
    >
      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${meta.dotClass}`} aria-hidden="true" />
      {meta.label}
    </span>
  );
}
