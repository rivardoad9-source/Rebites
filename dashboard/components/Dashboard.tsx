'use client';

import { useState } from 'react';
import {
  BarChart3,
  CloudOff,
  Coins,
  History,
  PlusCircle,
  RefreshCw,
  Sheet,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import { useDashboard, type EntityKind } from '@/hooks/useDashboard';
import { angka, namaBulan, rupiah } from '@/lib/format';
import BatchForm from './BatchForm';
import BatchQueue from './BatchQueue';
import BepProgress from './BepProgress';
import ExpenseForm from './ExpenseForm';
import HealthBadge from './HealthBadge';
import HistoryTable from './HistoryTable';
import MetricCard from './MetricCard';
import RevenueChart from './RevenueChart';
import SaleForm from './SaleForm';
import { Notice } from './ui';

type Tab = 'ringkasan' | 'input' | 'riwayat';

const TABS: { key: Tab; label: string; Icon: typeof BarChart3 }[] = [
  { key: 'ringkasan', label: 'Ringkasan', Icon: BarChart3 },
  { key: 'input', label: 'Input', Icon: PlusCircle },
  { key: 'riwayat', label: 'Riwayat', Icon: History },
];

export default function Dashboard() {
  const {
    snapshot,
    loading,
    syncing,
    error,
    online,
    pending,
    lastSyncedAt,
    refresh,
    submit,
    remove,
    dismissError,
  } = useDashboard();
  const [tab, setTab] = useState<Tab>('ringkasan');

  const { metrics, bep, chart } = snapshot;
  const proyeksi = chart.length > 0 ? (chart[chart.length - 1].proyeksi ?? 0) : 0;

  const handleSubmit = (kind: EntityKind, label: string) => async (payload: Record<string, unknown>) => {
    const result = await submit(kind, payload, label);
    return { ok: result.ok, queued: result.queued };
  };

  const handleDelete = (kind: EntityKind, id: string) => {
    const labels: Record<EntityKind, string> = {
      sale: 'Hapus penjualan',
      batch: 'Hapus batch',
      expense: 'Hapus pengeluaran',
    };
    if (typeof window !== 'undefined' && !window.confirm(`${labels[kind]} ini?`)) return;
    void remove(kind, id, labels[kind]);
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-4 pb-24 lg:pb-8">
      {/* -------------------------------------------------------- header */}
      <header className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-mango-deep uppercase">
              Re-Bites POS
            </p>
            <h1 className="text-xl leading-tight font-extrabold text-coffee sm:text-2xl">
              Mango Cheese Dashboard
            </h1>
            <p className="text-xs text-coffee/55">{namaBulan()}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {metrics.totalOmzet > 0 ? (
              <HealthBadge health={metrics.health} netMargin={metrics.netMargin} />
            ) : (
              <span className="rounded-full border border-coffee/15 bg-white px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-coffee/55">
                Belum ada penjualan
              </span>
            )}
            <button
              type="button"
              onClick={() => void refresh('recalc')}
              disabled={syncing}
              className="btn-ghost"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} aria-hidden />
              {syncing ? 'Sinkron…' : 'Sinkron'}
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold ${
              snapshot.source === 'sheets'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-amber-200 bg-amber-50 text-amber-900'
            }`}
          >
            <Sheet className="h-3.5 w-3.5" aria-hidden />
            {snapshot.source === 'sheets' ? 'Google Sheets tersambung' : 'Mode lokal (belum tersambung Sheets)'}
          </span>

          {!online ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 font-semibold text-red-700">
              <CloudOff className="h-3.5 w-3.5" aria-hidden />
              Offline — pakai cache HP
            </span>
          ) : null}

          {pending.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-900">
              {pending.length} input menunggu terkirim
            </span>
          ) : null}

          {lastSyncedAt ? (
            <span className="text-coffee/45">
              Sinkron terakhir{' '}
              {new Date(lastSyncedAt).toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span className="flex-1">{error}</span>
          <button type="button" onClick={dismissError} aria-label="Tutup pesan">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : null}

      {loading && snapshot.sales.length === 0 && snapshot.batches.length === 0 ? (
        <Notice>Memuat data…</Notice>
      ) : null}

      {/* ---------------------------------------------------- ringkasan */}
      <section className={`${tab === 'ringkasan' ? 'block' : 'hidden'} space-y-4 lg:block`}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Total Omzet"
            value={metrics.totalOmzet}
            hint={`${angka(metrics.cupsSold)} cup terjual`}
            Icon={TrendingUp}
            tone="mango"
          />
          <MetricCard
            label="HPP Terpakai"
            value={metrics.totalHpp}
            hint={`Rata-rata ${rupiah(metrics.avgCogsPerCup)}/cup`}
            Icon={Coins}
            tone="leaf"
          />
          <MetricCard
            label="Total OPEX"
            value={metrics.totalOpex}
            hint="Operasional di luar bahan"
            Icon={Wallet}
            tone="neutral"
          />
          <MetricCard
            label="Laba Bersih"
            value={metrics.netProfit}
            hint={`Laba kotor ${rupiah(metrics.grossProfit)}`}
            Icon={metrics.netProfit < 0 ? TrendingDown : TrendingUp}
            tone={metrics.netProfit < 0 ? 'danger' : 'leaf'}
          />
        </div>

        {snapshot.warnings.length > 0 ? (
          <Notice tone="warning">
            {snapshot.warnings.length === 1
              ? snapshot.warnings[0]
              : `${snapshot.warnings.length} transaksi memakai stok yang batch-nya belum diinput. Cek tab Riwayat › Penjualan.`}
          </Notice>
        ) : null}

        <RevenueChart data={chart} bulan={namaBulan()} proyeksiAkhirBulan={proyeksi} />

        <div className="grid gap-4 lg:grid-cols-2">
          <BepProgress bep={bep} />
          <BatchQueue batches={snapshot.batches} onDelete={(id) => handleDelete('batch', id)} />
        </div>
      </section>

      {/* -------------------------------------------------------- input */}
      <section
        className={`${tab === 'input' ? 'block' : 'hidden'} mt-0 space-y-4 lg:mt-4 lg:block`}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <SaleForm
            batches={snapshot.batches}
            defaultPrice={metrics.avgPricePerCup || 15000}
            onSubmit={handleSubmit('sale', 'Input penjualan')}
          />
          <BatchForm onSubmit={handleSubmit('batch', 'Input batch belanja')} />
          <ExpenseForm onSubmit={handleSubmit('expense', 'Input pengeluaran')} />
        </div>
      </section>

      {/* ------------------------------------------------------- riwayat */}
      <section
        className={`${tab === 'riwayat' ? 'block' : 'hidden'} mt-0 space-y-4 lg:mt-4 lg:block`}
      >
        <HistoryTable snapshot={snapshot} onDelete={(kind, id) => handleDelete(kind, id)} />
      </section>

      {/* ------------------------------------------ bottom nav (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-coffee/10 bg-milk/95 backdrop-blur lg:hidden">
        <ul className="mx-auto flex max-w-5xl">
          {TABS.map(({ key, label, Icon }) => (
            <li key={key} className="flex-1">
              <button
                type="button"
                onClick={() => setTab(key)}
                aria-current={tab === key ? 'page' : undefined}
                className={`flex w-full flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition ${
                  tab === key ? 'text-mango-deep' : 'text-coffee/50'
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {label}
              </button>
            </li>
          ))}
        </ul>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </div>
  );
}
