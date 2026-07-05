import type { HTMLAttributes } from 'react';

type Tone = 'neutral' | 'success' | 'warning' | 'info' | 'danger' | 'amber' | 'violet' | 'sky' | 'emerald' | 'rose';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-800',
  info: 'bg-teal-100 text-teal-700',
  danger: 'bg-rose-100 text-rose-700',
  // The five order-lifecycle status tones (see src/lib/orderStatus.ts) —
  // kept here too so Badge alone can render any status tone consistently.
  amber: 'bg-amber-50 text-amber-800',
  violet: 'bg-violet-50 text-violet-800',
  sky: 'bg-sky-50 text-sky-800',
  emerald: 'bg-emerald-50 text-emerald-800',
  rose: 'bg-rose-50 text-rose-800',
};

export function Badge({ tone = 'neutral', className = '', ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE_CLASSES[tone]} ${className}`}
      {...props}
    />
  );
}
