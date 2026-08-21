'use client';

import type { ReactNode } from 'react';

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs text-coffee/55">{hint}</p> : null}
    </div>
  );
}

/** Input angka: mode numerik supaya HP langsung buka keypad angka. */
export function NumberInput({
  id,
  value,
  onChange,
  placeholder,
  min = 0,
  step = 1,
  prefix,
  suffix,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div className="relative">
      {prefix ? (
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm font-semibold text-coffee/45">
          {prefix}
        </span>
      ) : null}
      <input
        id={id}
        type="number"
        inputMode="numeric"
        pattern="[0-9]*"
        min={min}
        step={step}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={`field tabular-nums ${prefix ? 'pl-10' : ''} ${suffix ? 'pr-14' : ''}`}
      />
      {suffix ? (
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm font-semibold text-coffee/45">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

export function QuickPicks({
  values,
  onPick,
  format = (v: number) => `${v}`,
}: {
  values: number[];
  onPick: (value: number) => void;
  format?: (value: number) => string;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {values.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onPick(value)}
          className="rounded-full border border-coffee/15 bg-white px-3 py-1.5 text-sm font-semibold text-coffee/80 active:scale-[0.98]"
        >
          {format(value)}
        </button>
      ))}
    </div>
  );
}

export function FormCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card">
      <header className="mb-4 flex items-start gap-2">
        {icon}
        <div>
          <h2 className="text-base leading-tight font-bold text-coffee">{title}</h2>
          {description ? <p className="text-xs text-coffee/55">{description}</p> : null}
        </div>
      </header>
      {children}
    </section>
  );
}

export function Notice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'success' | 'warning' | 'error';
  children: ReactNode;
}) {
  const tones = {
    info: 'bg-coffee/5 text-coffee/80 border-coffee/10',
    success: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    warning: 'bg-amber-50 text-amber-900 border-amber-200',
    error: 'bg-red-50 text-red-800 border-red-200',
  } as const;

  return (
    <p className={`rounded-xl border px-3 py-2 text-sm ${tones[tone]}`} role="status">
      {children}
    </p>
  );
}
