import { forwardRef, type InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, id, name, className = '', ...props },
  ref,
) {
  const inputId = id ?? name;
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <input
        id={inputId}
        name={name}
        ref={ref}
        className={`rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 outline-none transition duration-150 ease-out placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 ${
          error ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-100' : 'border-slate-300'
        } ${className}`}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {error && (
        <span className="text-xs text-rose-600" role="alert">
          {error}
        </span>
      )}
    </div>
  );
});
