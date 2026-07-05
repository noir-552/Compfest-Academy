import type { ReactNode } from 'react';

export interface EmptyStateProps {
  icon?: ReactNode;
  heading: string;
  /** One-line teach: explain what this screen is for or what to do next. */
  teachLine?: string;
  action?: ReactNode;
}

const DEFAULT_ICON = (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
    <path
      d="M4 7h16M4 12h16M4 17h10"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * A designed empty state (DESIGN.md "every state is designed") — icon +
 * heading + one-line teach + optional action. Use in place of a bare
 * "belum ada ..." paragraph for lists that can legitimately be empty.
 */
export function EmptyState({ icon = DEFAULT_ICON, heading, teachLine, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        {icon}
      </span>
      <p className="text-sm font-semibold text-slate-900">{heading}</p>
      {teachLine && <p className="max-w-xs text-sm text-slate-500">{teachLine}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
