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
import { rupiah, rupiahShort } from '@/lib/format';
import type { ChartPoint } from '@/lib/types';

/** Warna seri sudah lolos cek kontras + colour-vision-deficiency. */
const OMZET = '#C85F19';
const PENGELUARAN = '#0E9488';
const PROYEKSI = '#8B7B6E';

interface TooltipEntry {
  dataKey?: string | number;
  value?: number | null;
}

function ChartTooltip({
  active,
  payload,
  label,
  bulan,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  bulan: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const get = (key: string) => payload.find((p) => p.dataKey === key)?.value;
  const omzet = get('omzet');
  const pengeluaran = get('pengeluaran');
  const proyeksi = get('proyeksi');

  return (
    <div className="rounded-xl border border-coffee/10 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      <p className="mb-1 font-semibold text-coffee">
        {label} {bulan}
      </p>
      <ul className="space-y-1 tabular-nums">
        {typeof omzet === 'number' ? (
          <Row color={OMZET} name="Omzet kumulatif" value={omzet} />
        ) : null}
        {typeof pengeluaran === 'number' ? (
          <Row color={PENGELUARAN} name="Pengeluaran kumulatif" value={pengeluaran} />
        ) : null}
        {typeof proyeksi === 'number' ? (
          <Row color={PROYEKSI} name="Proyeksi omzet" value={proyeksi} dashed />
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
      <span className="flex items-center gap-1.5 text-coffee/70">
        <span
          className="inline-block h-0 w-3 border-t-2"
          style={{ borderColor: color, borderStyle: dashed ? 'dashed' : 'solid' }}
          aria-hidden
        />
        {name}
      </span>
      <span className="font-semibold text-coffee">{rupiah(value)}</span>
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
  const tickInterval = data.length > 20 ? 4 : 2;

  return (
    <section className="card">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-coffee">Omzet vs Pengeluaran</h2>
          <p className="text-xs text-coffee/55">Kumulatif {bulan}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-coffee/55">Proyeksi akhir bulan</p>
          <p className="text-sm font-extrabold tabular-nums text-coffee">
            {rupiah(proyeksiAkhirBulan)}
          </p>
        </div>
      </header>

      <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-coffee/70">
        <Legend color={OMZET} label="Omzet" />
        <Legend color={PENGELUARAN} label="Pengeluaran (HPP + OPEX)" />
        <Legend color={PROYEKSI} label="Proyeksi omzet" dashed />
      </ul>

      <div className="h-56 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="fillOmzet" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={OMZET} stopOpacity={0.28} />
                <stop offset="100%" stopColor={OMZET} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="fillPengeluaran" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={PENGELUARAN} stopOpacity={0.22} />
                <stop offset="100%" stopColor={PENGELUARAN} stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke="#2B1B12" strokeOpacity={0.08} vertical={false} />
            <XAxis
              dataKey="label"
              interval={tickInterval}
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#2B1B12', fillOpacity: 0.55, fontSize: 11 }}
            />
            <YAxis
              width={58}
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#2B1B12', fillOpacity: 0.55, fontSize: 11 }}
              tickFormatter={(v: number) => rupiahShort(v).replace('Rp ', '')}
            />
            <Tooltip
              cursor={{ stroke: '#2B1B12', strokeOpacity: 0.25, strokeWidth: 1 }}
              content={<ChartTooltip bulan={bulan} />}
            />

            <Area
              type="monotone"
              dataKey="omzet"
              name="Omzet"
              stroke={OMZET}
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
              stroke={PENGELUARAN}
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
              stroke={PROYEKSI}
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
