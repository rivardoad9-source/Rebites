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
      {hint ? <p className="mt-1 text-xs text-ink/55">{hint}</p> : null}
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
  prefix,
  suffix,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: number;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div className="relative">
      {prefix ? (
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm font-semibold text-ink/45">
          {prefix}
        </span>
      ) : null}
      <input
        id={id}
        type="number"
        inputMode="numeric"
        pattern="[0-9]*"
        min={min}
        /*
         * step="any" disengaja: dengan step angka (mis. 1000) browser menolak
         * nominal yang bukan kelipatannya — "26400" jadi dianggap tidak valid.
         * Pembulatan ke rupiah utuh tetap dijamin Math.round() saat submit.
         */
        step="any"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={`field tabular-nums ${prefix ? 'pl-10' : ''} ${suffix ? 'pr-14' : ''}`}
      />
      {suffix ? (
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm font-semibold text-ink/45">
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
          className="rounded-full border border-ink/15 bg-field px-3 py-1.5 text-sm font-semibold text-ink/80 active:scale-[0.98]"
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
          <h2 className="text-base leading-tight font-bold text-ink">{title}</h2>
          {description ? <p className="text-xs text-ink/55">{description}</p> : null}
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
    info: 'bg-ink/5 text-ink/80 border-ink/10',
    success: 'bg-good-soft text-good border-good/30',
    warning: 'bg-warn-soft text-warn border-warn/30',
    error: 'bg-bad-soft text-bad border-bad/30',
  } as const;

  return (
    <p className={`rounded-xl border px-3 py-2 text-sm ${tones[tone]}`} role="status">
      {children}
    </p>
  );
}
