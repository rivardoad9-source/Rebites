'use client';

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '@/hooks/useTheme';
import { rupiah, rupiahShort } from '@/lib/format';
import type { ChartPoint } from '@/lib/types';

/**
 * Dua set warna seri, masing-masing sudah lolos cek kontras terhadap latar
 * mode-nya dan cek keterbacaan untuk buta warna (protan/deutan/tritan).
 */
const PALETTE = {
  light: { omzet: '#2B57E8', pengeluaran: '#C2410C', proyeksi: '#7A8296', ink: '#131A2E' },
  dark: { omzet: '#5C86F0', pengeluaran: '#D4762B', proyeksi: '#96A0B8', ink: '#EEF2FB' },
} as const;

type SeriesColors = { omzet: string; pengeluaran: string; proyeksi: string; ink: string };

interface TooltipEntry {
  dataKey?: string | number;
  value?: number | null;
}

function ChartTooltip({
  active,
  payload,
  label,
  bulan,
  colors,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  bulan: string;
  colors: SeriesColors;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const get = (key: string) => payload.find((p) => p.dataKey === key)?.value;
  const omzet = get('omzet');
  const pengeluaran = get('pengeluaran');
  const proyeksi = get('proyeksi');

  return (
    <div className="rounded-xl border border-ink/10 bg-card/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      <p className="mb-1 font-semibold text-ink">
        {label} {bulan}
      </p>
      <ul className="space-y-1 tabular-nums">
        {typeof omzet === 'number' ? (
          <Row color={colors.omzet} name="Omzet kumulatif" value={omzet} />
        ) : null}
        {typeof pengeluaran === 'number' ? (
          <Row color={colors.pengeluaran} name="Pengeluaran kumulatif" value={pengeluaran} />
        ) : null}
        {typeof proyeksi === 'number' ? (
          <Row color={colors.proyeksi} name="Proyeksi omzet" value={proyeksi} dashed />
        ) : null}
      </ul>
    </div>
  );
}

function Row({
  color,
  name,
  value,
  dashed,
}: {
  color: string;
  name: string;
  value: number;
  dashed?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-ink/70">
        <span
          className="inline-block h-0 w-3 border-t-2"
          style={{ borderColor: color, borderStyle: dashed ? 'dashed' : 'solid' }}
          aria-hidden
        />
        {name}
      </span>
      <span className="font-semibold text-ink">{rupiah(value)}</span>
    </li>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <li className="flex items-center gap-1.5">
      <span
        className="inline-block h-0 w-4 border-t-2"
        style={{ borderColor: color, borderStyle: dashed ? 'dashed' : 'solid' }}
        aria-hidden
      />
      {label}
    </li>
  );
}

export default function RevenueChart({
  data,
  bulan,
  proyeksiAkhirBulan,
}: {
  data: ChartPoint[];
  bulan: string;
  proyeksiAkhirBulan: number;
}) {
  const { dark } = useTheme();
  const colors: SeriesColors = dark ? PALETTE.dark : PALETTE.light;
  const tickInterval = data.length > 20 ? 4 : 2;

  return (
    <section className="card">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-ink">Omzet vs Pengeluaran</h2>
          <p className="text-xs text-ink/55">Kumulatif {bulan}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-ink/55">Proyeksi akhir bulan</p>
          <p className="text-sm font-extrabold tabular-nums text-ink">
            {rupiah(proyeksiAkhirBulan)}
          </p>
        </div>
      </header>

      <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/70">
        <Legend color={colors.omzet} label="Omzet" />
        <Legend color={colors.pengeluaran} label="Pengeluaran (HPP + OPEX)" />
        <Legend color={colors.proyeksi} label="Proyeksi omzet" dashed />
      </ul>

      <div className="h-56 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="fillOmzet" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.omzet} stopOpacity={0.28} />
                <stop offset="100%" stopColor={colors.omzet} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="fillPengeluaran" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.pengeluaran} stopOpacity={0.22} />
                <stop offset="100%" stopColor={colors.pengeluaran} stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke={colors.ink} strokeOpacity={dark ? 0.14 : 0.08} vertical={false} />
            <XAxis
              dataKey="label"
              interval={tickInterval}
              tickLine={false}
              axisLine={false}
              tick={{ fill: colors.ink, fillOpacity: 0.55, fontSize: 11 }}
            />
            <YAxis
              width={58}
              tickLine={false}
              axisLine={false}
              tick={{ fill: colors.ink, fillOpacity: 0.55, fontSize: 11 }}
              tickFormatter={(v: number) => rupiahShort(v).replace('Rp ', '')}
            />
            <Tooltip
              cursor={{ stroke: colors.ink, strokeOpacity: 0.3, strokeWidth: 1 }}
              content={<ChartTooltip bulan={bulan} colors={colors} />}
            />

            <Area
              type="monotone"
              dataKey="omzet"
              name="Omzet"
              stroke={colors.omzet}
              strokeWidth={2}
              fill="url(#fillOmzet)"
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="pengeluaran"
              name="Pengeluaran"
              stroke={colors.pengeluaran}
              strokeWidth={2}
              fill="url(#fillPengeluaran)"
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="proyeksi"
              name="Proyeksi"
              stroke={colors.proyeksi}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
