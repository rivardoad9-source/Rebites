'use client';

import { useMemo, useState } from 'react';
import { CalendarRange, Trash2 } from 'lucide-react';
import { angka, rupiah, tanggal, tanggalPendek, todayISO } from '@/lib/format';
import type { Snapshot } from '@/lib/types';

type TabKey = 'harian' | 'penjualan' | 'opex';

const TABS: { key: TabKey; label: string; short: string }[] = [
  { key: 'harian', label: 'Rekap Harian', short: 'Harian' },
  { key: 'penjualan', label: 'Penjualan', short: 'Penjualan' },
  { key: 'opex', label: 'OPEX', short: 'OPEX' },
];

function firstDayOfMonth(): string {
  return `${todayISO().slice(0, 8)}01`;
}

function shiftDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
}

/** Riwayat transaksi harian dengan filter rentang tanggal. */
export default function HistoryTable({
  snapshot,
  onDelete,
}: {
  snapshot: Snapshot;
  onDelete: (kind: 'sale' | 'expense', id: string) => void;
}) {
  const [tab, setTab] = useState<TabKey>('harian');
  const [from, setFrom] = useState(firstDayOfMonth());
  const [to, setTo] = useState(todayISO());

  const inRange = useMemo(
    () => (date: string) => (!from || date >= from) && (!to || date <= to),
    [from, to],
  );

  const daily = snapshot.daily.filter((r) => inRange(r.date));
  const sales = snapshot.sales.filter((s) => inRange(s.date));
  const expenses = snapshot.expenses.filter((e) => inRange(e.date));

  const total = daily.reduce(
    (acc, r) => ({
      cups: acc.cups + r.cups,
      omzet: acc.omzet + r.omzet,
      hpp: acc.hpp + r.hpp,
      opex: acc.opex + r.opex,
      net: acc.net + r.netProfit,
    }),
    { cups: 0, omzet: 0, hpp: 0, opex: 0, net: 0 },
  );

  return (
    <section className="card">
      <header className="mb-3 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink/5 text-ink">
          <CalendarRange className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <h2 className="text-base leading-tight font-bold text-ink">Riwayat Transaksi</h2>
          <p className="text-xs text-ink/55">
            {tanggal(from)} – {tanggal(to)}
          </p>
        </div>
      </header>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <label className="text-xs font-semibold text-ink/60">
          Dari
          <input
            type="date"
            value={from}
            max={to}
            onChange={(event) => setFrom(event.target.value)}
            className="field mt-1"
          />
        </label>
        <label className="text-xs font-semibold text-ink/60">
          Sampai
          <input
            type="date"
            value={to}
            min={from}
            onChange={(event) => setTo(event.target.value)}
            className="field mt-1"
          />
        </label>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <RangeChip label="Hari ini" onClick={() => { setFrom(todayISO()); setTo(todayISO()); }} />
        <RangeChip label="7 hari" onClick={() => { setFrom(shiftDays(6)); setTo(todayISO()); }} />
        <RangeChip label="Bulan ini" onClick={() => { setFrom(firstDayOfMonth()); setTo(todayISO()); }} />
        <RangeChip label="Semua" onClick={() => { setFrom('2000-01-01'); setTo('2999-12-31'); }} />
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl bg-well px-3 py-2 text-sm sm:grid-cols-4">
        <Total label="Cup" value={angka(total.cups)} />
        <Total label="Omzet" value={rupiah(total.omzet)} />
        <Total label="HPP + OPEX" value={rupiah(total.hpp + total.opex)} />
        <Total label="Laba bersih" value={rupiah(total.net)} tone={total.net < 0 ? 'danger' : 'good'} />
      </div>

      <div
        className="mb-3 flex gap-1 rounded-xl bg-ink/5 p-1"
        role="tablist"
        aria-label="Jenis riwayat"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-2 py-2 text-sm font-semibold transition ${
              tab === t.key ? 'bg-field text-ink shadow-sm' : 'text-ink/55'
            }`}
          >
            <span className="sm:hidden">{t.short}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/*
        Di HP tabel 6-7 kolom bikin kolom aksi terdorong ke luar layar (tombol
        hapus jadi tidak terjangkau tanpa geser horizontal), jadi baris riwayat
        ditampilkan sebagai kartu. Tabel penuh dipakai mulai layar sm ke atas.
      */}
      <div className="space-y-2 sm:hidden">
        {tab === 'harian' ? (
          daily.length === 0 ? (
            <EmptyRows />
          ) : (
            daily.map((r) => (
              <article key={r.date} className="rounded-xl border border-ink/10 bg-well/60 p-3">
                <header className="flex items-center justify-between gap-2">
                  <p className="font-bold text-ink">{tanggal(r.date)}</p>
                  <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs font-semibold text-ink/70">
                    {angka(r.cups)} cup
                  </span>
                </header>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                  <Cell label="Omzet" value={rupiah(r.omzet)} />
                  <Cell label="HPP" value={rupiah(r.hpp)} />
                  <Cell label="OPEX" value={rupiah(r.opex)} />
                  <Cell
                    label="Laba bersih"
                    value={rupiah(r.netProfit)}
                    tone={r.netProfit < 0 ? 'danger' : 'good'}
                  />
                </dl>
              </article>
            ))
          )
        ) : null}

        {tab === 'penjualan' ? (
          sales.length === 0 ? (
            <EmptyRows />
          ) : (
            sales.map((s) => (
              <article key={s.id} className="rounded-xl border border-ink/10 bg-well/60 p-3">
                <header className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-ink">{tanggal(s.date)}</p>
                    <p className="text-xs text-ink/55">
                      {angka(s.cups)} cup × {rupiah(s.pricePerCup)}
                      {s.channel ? ` · ${s.channel}` : ''}
                    </p>
                  </div>
                  <DeleteButton
                    label={`Hapus penjualan ${s.date}`}
                    onClick={() => onDelete('sale', s.id)}
                  />
                </header>
                <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
                  <Cell label="Omzet" value={rupiah(s.revenue)} />
                  <Cell label="HPP FIFO" value={rupiah(s.cogs)} />
                  <Cell
                    label="Laba"
                    value={rupiah(s.grossProfit)}
                    tone={s.grossProfit < 0 ? 'danger' : 'good'}
                  />
                </dl>
                {s.shortageCups > 0 ? (
                  <p className="mt-1 text-xs text-warn">{s.shortageCups} cup belum ada batch-nya</p>
                ) : null}
                {s.note ? <p className="mt-1 text-xs text-ink/55">{s.note}</p> : null}
              </article>
            ))
          )
        ) : null}

        {tab === 'opex' ? (
          expenses.length === 0 ? (
            <EmptyRows />
          ) : (
            expenses.map((e) => (
              <article key={e.id} className="rounded-xl border border-ink/10 bg-well/60 p-3">
                <header className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-ink">{e.category}</p>
                    <p className="text-xs text-ink/55">{tanggal(e.date)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-extrabold tabular-nums text-ink">{rupiah(e.amount)}</span>
                    <DeleteButton
                      label={`Hapus pengeluaran ${e.category}`}
                      onClick={() => onDelete('expense', e.id)}
                    />
                  </div>
                </header>
                {e.note ? <p className="mt-1 text-xs text-ink/55">{e.note}</p> : null}
              </article>
            ))
          )
        ) : null}
      </div>

      <div className="-mx-4 hidden overflow-x-auto px-4 sm:block">
        {tab === 'harian' ? (
          <Table
            head={['Tanggal', 'Cup', 'Omzet', 'HPP', 'OPEX', 'Laba Bersih']}
            empty={daily.length === 0}
          >
            {daily.map((r) => (
              <tr key={r.date} className="border-t border-ink/8">
                <Td>{tanggalPendek(r.date)}</Td>
                <Td numeric>{angka(r.cups)}</Td>
                <Td numeric>{rupiah(r.omzet)}</Td>
                <Td numeric>{rupiah(r.hpp)}</Td>
                <Td numeric>{rupiah(r.opex)}</Td>
                <Td numeric tone={r.netProfit < 0 ? 'danger' : 'good'}>
                  {rupiah(r.netProfit)}
                </Td>
              </tr>
            ))}
          </Table>
        ) : null}

        {tab === 'penjualan' ? (
          <Table
            head={['Tanggal', 'Cup', 'Harga', 'Omzet', 'HPP FIFO', 'Laba', '']}
            empty={sales.length === 0}
          >
            {sales.map((s) => (
              <tr key={s.id} className="border-t border-ink/8">
                <Td>
                  {tanggalPendek(s.date)}
                  {s.channel ? <span className="block text-[11px] text-ink/45">{s.channel}</span> : null}
                </Td>
                <Td numeric>{angka(s.cups)}</Td>
                <Td numeric>{rupiah(s.pricePerCup)}</Td>
                <Td numeric>{rupiah(s.revenue)}</Td>
                <Td numeric>
                  {rupiah(s.cogs)}
                  {s.shortageCups > 0 ? (
                    <span className="block text-[11px] text-warn">
                      {s.shortageCups} cup tanpa batch
                    </span>
                  ) : null}
                </Td>
                <Td numeric tone={s.grossProfit < 0 ? 'danger' : 'good'}>
                  {rupiah(s.grossProfit)}
                </Td>
                <Td>
                  <DeleteButton
                    label={`Hapus penjualan ${s.date}`}
                    onClick={() => onDelete('sale', s.id)}
                  />
                </Td>
              </tr>
            ))}
          </Table>
        ) : null}

        {tab === 'opex' ? (
          <Table head={['Tanggal', 'Kategori', 'Nominal', 'Catatan', '']} empty={expenses.length === 0}>
            {expenses.map((e) => (
              <tr key={e.id} className="border-t border-ink/8">
                <Td>{tanggalPendek(e.date)}</Td>
                <Td>{e.category}</Td>
                <Td numeric>{rupiah(e.amount)}</Td>
                <Td>
                  <span className="text-ink/55">{e.note ?? '—'}</span>
                </Td>
                <Td>
                  <DeleteButton
                    label={`Hapus pengeluaran ${e.category}`}
                    onClick={() => onDelete('expense', e.id)}
                  />
                </Td>
              </tr>
            ))}
          </Table>
        ) : null}
      </div>
    </section>
  );
}

function EmptyRows() {
  return (
    <p className="rounded-xl bg-well px-3 py-6 text-center text-sm text-ink/55">
      Belum ada data di rentang tanggal ini.
    </p>
  );
}

function Cell({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'good' | 'danger';
}) {
  const tones = { neutral: 'text-ink', good: 'text-good', danger: 'text-bad' } as const;
  return (
    <div>
      <dt className="text-[11px] tracking-wide text-ink/50 uppercase">{label}</dt>
      <dd className={`font-semibold tabular-nums ${tones[tone]}`}>{value}</dd>
    </div>
  );
}

function Table({
  head,
  children,
  empty,
}: {
  head: string[];
  children: React.ReactNode;
  empty: boolean;
}) {
  if (empty) {
    return (
      <p className="rounded-xl bg-well px-3 py-6 text-center text-sm text-ink/55">
        Belum ada data di rentang tanggal ini.
      </p>
    );
  }

  return (
    <table className="w-full min-w-[520px] text-sm">
      <thead>
        <tr className="text-left text-[11px] tracking-wide text-ink/50 uppercase">
          {head.map((h, i) => (
            <th key={`${h}-${i}`} className="pb-2 font-semibold">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function Td({
  children,
  numeric,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  numeric?: boolean;
  tone?: 'neutral' | 'good' | 'danger';
}) {
  const tones = { neutral: 'text-ink', good: 'text-good', danger: 'text-bad' } as const;
  return (
    <td className={`py-2 pr-3 ${numeric ? 'tabular-nums' : ''} ${tones[tone]}`}>{children}</td>
  );
}

function DeleteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="rounded-lg p-1.5 text-ink/40 transition hover:bg-bad-soft hover:text-bad"
    >
      <Trash2 className="h-4 w-4" aria-hidden />
    </button>
  );
}

function RangeChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-ink/15 bg-field px-3 py-1.5 text-xs font-semibold text-ink/75 active:scale-[0.98]"
    >
      {label}
    </button>
  );
}

function Total({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'good' | 'danger';
}) {
  const tones = { neutral: 'text-ink', good: 'text-good', danger: 'text-bad' } as const;
  return (
    <div>
      <p className="text-[11px] tracking-wide text-ink/55 uppercase">{label}</p>
      <p className={`text-sm font-extrabold tabular-nums ${tones[tone]}`}>{value}</p>
    </div>
  );
}
