import type { HTMLAttributes } from 'react';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {}

/**
 * A shimmering `surface-2` placeholder block for loading states (DESIGN.md
 * "every state is designed"). Compose with utility classes for size, e.g.
 * `<Skeleton className="h-4 w-32" />`. Shimmer is disabled globally under
 * `prefers-reduced-motion: reduce` (see index.css).
 */
export function Skeleton({ className = '', ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-slate-100 bg-[linear-gradient(90deg,transparent,rgba(148,163,184,0.25),transparent)] bg-[length:200%_100%] ${className}`}
      aria-hidden="true"
      {...props}
    />
  );
}

/** A stack of skeleton rows shaped like a card list — for order/job lists while loading. */
export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Memuat...">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-2 h-3 w-24" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}
