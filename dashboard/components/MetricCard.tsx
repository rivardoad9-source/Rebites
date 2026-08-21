import type { LucideIcon } from 'lucide-react';
import { rupiah } from '@/lib/format';

export default function MetricCard({
  label,
  value,
  hint,
  Icon,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  hint?: string;
  Icon: LucideIcon;
  tone?: 'neutral' | 'mango' | 'leaf' | 'danger';
}) {
  const tones = {
    neutral: 'bg-coffee/5 text-coffee',
    mango: 'bg-mango/10 text-mango-deep',
    leaf: 'bg-leaf/10 text-leaf',
    danger: 'bg-red-100 text-red-700',
  } as const;

  const valueTone = value < 0 ? 'text-red-700' : 'text-coffee';

  return (
    <div className="card flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="text-xs font-semibold tracking-wide text-coffee/60 uppercase">
          {label}
        </span>
      </div>
      <p className={`text-xl leading-tight font-extrabold tabular-nums sm:text-2xl ${valueTone}`}>
        {rupiah(value)}
      </p>
      {hint ? <p className="text-xs text-coffee/55">{hint}</p> : null}
    </div>
  );
}
