import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Optional header title — renders above `children` alongside `actions`. */
  title?: ReactNode;
  /** Optional header-right slot (buttons, links) shown next to `title`. */
  actions?: ReactNode;
}

export function Card({ className = '', title, actions, children, ...props }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/5 ${className}`}
      {...props}
    >
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h3 className="text-sm font-semibold text-slate-900">{title}</h3>}
          {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
