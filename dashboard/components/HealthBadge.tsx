import { Activity, AlertTriangle, HeartPulse } from 'lucide-react';
import { persen } from '@/lib/format';
import type { HealthLevel } from '@/lib/types';

const STYLE: Record<
  HealthLevel,
  { label: string; hint: string; className: string; Icon: typeof HeartPulse }
> = {
  SEHAT: {
    label: 'Sehat',
    hint: 'Net margin ≥ 40%',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    Icon: HeartPulse,
  },
  WASPADA: {
    label: 'Waspada',
    hint: 'Net margin 20–39%',
    className: 'bg-amber-50 text-amber-900 border-amber-300',
    Icon: Activity,
  },
  KRITIS: {
    label: 'Kritis',
    hint: 'Net margin < 20%',
    className: 'bg-red-50 text-red-800 border-red-300',
    Icon: AlertTriangle,
  },
};

export default function HealthBadge({
  health,
  netMargin,
  size = 'md',
}: {
  health: HealthLevel;
  netMargin: number;
  size?: 'sm' | 'md';
}) {
  const { label, hint, className, Icon } = STYLE[health];
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 whitespace-nowrap ${
        size === 'sm' ? 'py-1 text-xs' : 'py-1.5 text-sm'
      } font-semibold ${className}`}
      title={hint}
    >
      <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden />
      <span>{label}</span>
      <span className="opacity-70">· {persen(netMargin)}</span>
    </div>
  );
}
