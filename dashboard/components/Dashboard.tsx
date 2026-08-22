'use client';

import { useCallback, useState } from 'react';
import {
  BarChart3,
  CloudOff,
  Coins,
  History,
  Monitor,
  Moon,
  PlusCircle,
  RefreshCw,
  Sheet,
  Sun,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import { useDashboard, type EntityKind } from '@/hooks/useDashboard';
import { useTheme } from '@/hooks/useTheme';
import { angka, namaBulan, rupiah } from '@/lib/format';
import BatchForm from './BatchForm';
import BatchQueue from './BatchQueue';
import BepProgress from './BepProgress';
import EmptyState from './EmptyState';
import ExpenseForm from './ExpenseForm';
import HealthBadge from './HealthBadge';
import HistoryTable from './HistoryTable';
import MetricCard from './MetricCard';
import RevenueChart from './RevenueChart';
import SaleForm from './SaleForm';
import Skeleton from './Skeleton';
import Toast, { type ToastState } from './Toast';
import { Notice } from './ui';

type Tab = 'ringkasan' | 'input' | 'riwayat';

const TABS: { key: Tab; label: string; Icon: typeof BarChart3 }[] = [
  { key: 'ringkasan', label: 'Ringkasan', Icon: BarChart3 },
  { key: 'input', label: 'Input', Icon: PlusCircle },
  { key: 'riwayat', label: 'Riwayat', Icon: History },
];

const DELETE_LABEL: Record<EntityKind, string> = {
  sale: 'Penjualan dihapus',
  batch: 'Batch dihapus',
  expense: 'Pengeluaran dihapus',
};

export default function Dashboard() {
  const {
    snapshot,
    loading,
    syncing,
    error,
    online,
    pending,
    lastSyncedAt,
    hasData,
    refresh,
    submit,
    remove,
    dismissError,
  } = useDashboard();
  const { pref, cycle } = useTheme();
  const [tab, setTab] = useState<Tab>('ringkasan');
  const [toast, setToast] = useState<ToastState | null>(null);

  const { metrics, bep, chart } = snapshot;
  const proyeksi = chart.length > 0 ? (chart[chart.length - 1].proyeksi ?? 0) : 0;

  const showToast = useCallback((next: Omit<ToastState, 'id'>) => {
    setToast({ ...next, id: Date.now() });
  }, []);

  const handleSubmit =
    (kind: EntityKind, label: string) => async (payload: Record<string, unknown>) => {
      const result = await submit(kind, payload, label);
      return { ok: result.ok, queued: result.queued };
    };

  /**
   * Hapus tanpa dialog konfirmasi — di HP lebih enak langsung jalan lalu
   * disediakan tombol "Urungkan" di toast (input ulang dengan data yang sama).
   */
  const handleDelete = useCallback(
    (kind: EntityKind, id: string) => {
      const restore = restorePayload(kind, id, snapshot);
      void remove(kind, id, DELETE_LABEL[kind]);
      showToast({
        text: DELETE_LABEL[kind],
        actionLabel: restore ? 'Urungkan' : undefined,
        onAction: restore
          ? () => {
              void submit(kind, restore, `Urungkan ${DELETE_LABEL[kind].toLowerCase()}`);
            }
          : undefined,
      });
    },
    [remove, showToast, snapshot, submit],
  );

  const ThemeIcon = pref === 'light' ? Sun : pref === 'dark' ? Moon : Monitor;
  const themeLabel =
    pref === 'light' ? 'Tema terang' : pref === 'dark' ? 'Tema gelap' : 'Tema ikut HP';

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-4 pb-24 lg:pb-8">
      {/* -------------------------------------------------------- header */}
      <header className="sticky top-0 z-20 -mx-4 mb-4 border-b border-ink/8 bg-page/90 px-4 pt-2 pb-3 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-mango-deep uppercase">
              Re-Bites POS
            </p>
            <h1 className="text-xl leading-tight font-extrabold text-ink sm:text-2xl">
              Mango Cheese Dashboard
            </h1>
            <p className="text-xs text-ink/55">{namaBulan()}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {metrics.totalOmzet > 0 ? (
              <HealthBadge health={metrics.health} netMargin={metrics.netMargin} />
            ) : (
              <span className="rounded-full border border-ink/15 bg-field px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-ink/55">
                Belum ada penjualan
              </span>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={cycle}
                className="btn-ghost px-2.5"
                aria-label={`${themeLabel} — ketuk untuk ganti`}
                title={themeLabel}
              >
                <ThemeIcon className="h-4 w-4" aria-hidden />
              </button>
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
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold ${
              snapshot.source === 'sheets'
                ? 'border-good/30 bg-good-soft text-good'
                : 'border-warn/30 bg-warn-soft text-warn'
            }`}
          >
            <Sheet className="h-3.5 w-3.5" aria-hidden />
            {snapshot.source === 'sheets'
              ? 'Google Sheets tersambung'
              : 'Mode lokal (belum tersambung Sheets)'}
          </span>

          {!online ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-bad/30 bg-bad-soft px-2.5 py-1 font-semibold text-bad">
              <CloudOff className="h-3.5 w-3.5" aria-hidden />
              Offline — pakai cache HP
            </span>
          ) : null}

          {pending.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-warn/30 bg-warn-soft px-2.5 py-1 font-semibold text-warn">
              {pending.length} input menunggu terkirim
            </span>
          ) : null}

          {lastSyncedAt ? (
            <span className="text-ink/45">
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
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-warn/30 bg-warn-soft px-3 py-2 text-sm text-warn">
          <span className="flex-1">{error}</span>
          <button type="button" onClick={dismissError} aria-label="Tutup pesan">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : null}

      {loading && !hasData ? <Skeleton /> : null}

      {!loading && !hasData ? (
        <div className="mb-4">
          <EmptyState onStart={() => setTab('input')} />
        </div>
      ) : null}

      {/* ---------------------------------------------------- ringkasan */}
      {hasData ? (
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
      ) : null}

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
      {hasData ? (
        <section
          className={`${tab === 'riwayat' ? 'block' : 'hidden'} mt-0 space-y-4 lg:mt-4 lg:block`}
        >
          <HistoryTable snapshot={snapshot} onDelete={(kind, id) => handleDelete(kind, id)} />
        </section>
      ) : null}

      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {/* ------------------------------------------ bottom nav (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-ink/10 bg-card/95 backdrop-blur lg:hidden">
        <ul className="mx-auto flex max-w-5xl">
          {TABS.map(({ key, label, Icon }) => (
            <li key={key} className="flex-1">
              <button
                type="button"
                onClick={() => setTab(key)}
                aria-current={tab === key ? 'page' : undefined}
                className={`flex w-full flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition ${
                  tab === key ? 'text-mango-deep' : 'text-ink/50'
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

/** Data untuk membuat ulang baris yang baru saja dihapus (tombol "Urungkan"). */
function restorePayload(
  kind: EntityKind,
  id: string,
  snapshot: ReturnType<typeof useDashboard>['snapshot'],
): Record<string, unknown> | null {
  if (kind === 'sale') {
    const s = snapshot.sales.find((row) => row.id === id);
    return s
      ? { date: s.date, cups: s.cups, pricePerCup: s.pricePerCup, channel: s.channel, note: s.note }
      : null;
  }
  if (kind === 'batch') {
    const b = snapshot.batches.find((row) => row.id === id);
    return b
      ? { date: b.date, itemName: b.itemName, totalCost: b.totalCost, yieldCup: b.yieldCup, note: b.note }
      : null;
  }
  const e = snapshot.expenses.find((row) => row.id === id);
  return e ? { date: e.date, category: e.category, amount: e.amount, note: e.note } : null;
}
