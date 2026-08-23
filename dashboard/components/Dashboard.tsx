"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  CloudOff,
  History,
  Layers,
  LogOut,
  Monitor,
  Moon,
  Plus,
  Sheet,
  Sun,
  X,
} from "lucide-react";
import { useDashboard, type EntityKind } from "@/hooks/useDashboard";
import { useTheme } from "@/hooks/useTheme";
import { angka, namaBulan, rupiah, todayISO } from "@/lib/format";
import BatchForm from "./BatchForm";
import BatchQueue from "./BatchQueue";
import EmptyState from "./EmptyState";
import ExpenseForm from "./ExpenseForm";
import HealthBadge from "./HealthBadge";
import HistoryTable from "./HistoryTable";
import HeroCard from "./HeroCard";
import PoBoard from "./PoBoard";
import StatPills from "./StatPills";
import RevenueChart from "./RevenueChart";
import SaleForm from "./SaleForm";
import Skeleton from "./Skeleton";
import Toast, { type ToastState } from "./Toast";
import { Notice } from "./ui";

type Tab = "ringkasan" | "stok" | "input" | "po" | "riwayat";

/** Dua di kiri dan dua di kanan; tombol tambah berdiri sendiri di tengah. */
const NAV_LEFT: { key: Tab; label: string; Icon: typeof BarChart3 }[] = [
  { key: "ringkasan", label: "Ringkasan", Icon: BarChart3 },
  { key: "stok", label: "Stok", Icon: Layers },
];

const NAV_RIGHT: { key: Tab; label: string; Icon: typeof BarChart3 }[] = [
  { key: "po", label: "PO", Icon: ClipboardList },
  { key: "riwayat", label: "Riwayat", Icon: History },
];

const DELETE_LABEL: Record<EntityKind, string> = {
  sale: "Penjualan dihapus",
  batch: "Batch dihapus",
  expense: "Pengeluaran dihapus",
};

export default function Dashboard({
  authEnabled = false,
}: {
  authEnabled?: boolean;
}) {
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
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("ringkasan");
  const [toast, setToast] = useState<ToastState | null>(null);

  const { metrics, chart } = snapshot;
  const proyeksi =
    chart.length > 0 ? (chart[chart.length - 1].proyeksi ?? 0) : 0;

  const showToast = useCallback((next: Omit<ToastState, "id">) => {
    setToast({ ...next, id: Date.now() });
  }, []);

  const handleSubmit =
    (kind: EntityKind, label: string) =>
    async (payload: Record<string, unknown>) => {
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
        actionLabel: restore ? "Urungkan" : undefined,
        onAction: restore
          ? () => {
              void submit(
                kind,
                restore,
                `Urungkan ${DELETE_LABEL[kind].toLowerCase()}`,
              );
            }
          : undefined,
      });
    },
    [remove, showToast, snapshot, submit],
  );

  const logout = useCallback(async () => {
    try {
      await fetch("/api/login", { method: "DELETE" });
    } catch {
      // Offline: cookie tetap dihapus saat request berhasil nanti.
    }
    router.replace("/login");
    router.refresh();
  }, [router]);

  const ThemeIcon = pref === "light" ? Sun : pref === "dark" ? Moon : Monitor;
  const themeLabel =
    pref === "light"
      ? "Tema terang"
      : pref === "dark"
        ? "Tema gelap"
        : "Tema ikut HP";

  const hariIni = snapshot.daily.find((row) => row.date === todayISO()) ?? null;
  const initial = "R";

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-4 pb-28 lg:pb-8">
      {/* -------------------------------------------------------- header */}
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-ink/55">{hariIniLabel()}</p>
          <h1 className="text-2xl leading-tight font-extrabold text-ink">
            Dashboard
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={cycle}
            className="grid h-9 w-9 place-items-center rounded-full bg-card text-ink/60 shadow-[0_1px_4px_rgba(43,27,18,0.10)] transition active:scale-95"
            aria-label={`${themeLabel} — ketuk untuk ganti`}
            title={themeLabel}
          >
            <ThemeIcon className="h-4 w-4" aria-hidden />
          </button>
          {authEnabled ? (
            <button
              type="button"
              onClick={() => void logout()}
              className="grid h-9 w-9 place-items-center rounded-full bg-card text-ink/60 shadow-[0_1px_4px_rgba(43,27,18,0.10)] transition active:scale-95"
              aria-label="Keluar"
            >
              <LogOut className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
          <span
            className="grid h-10 w-10 place-items-center rounded-full bg-mango text-base font-extrabold text-white shadow-[0_4px_12px_-4px_rgba(200,95,25,0.8)]"
            aria-hidden
          >
            {initial}
          </span>
        </div>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold ${
            snapshot.source === "sheets"
              ? "bg-good-soft text-good"
              : "bg-warn-soft text-warn"
          }`}
        >
          <Sheet className="h-3.5 w-3.5" aria-hidden />
          {snapshot.source === "sheets"
            ? "Google Sheets tersambung"
            : "Mode lokal"}
        </span>

        {!online ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-bad-soft px-2.5 py-1 font-semibold text-bad">
            <CloudOff className="h-3.5 w-3.5" aria-hidden />
            Offline — pakai cache HP
          </span>
        ) : null}

        {pending.length > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warn-soft px-2.5 py-1 font-semibold text-warn">
            {pending.length} input menunggu terkirim
          </span>
        ) : null}

        {lastSyncedAt ? (
          <span className="text-ink/40">
            Sinkron{" "}
            {new Date(lastSyncedAt).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        ) : null}
      </div>

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
          <EmptyState onStart={() => setTab("input")} />
        </div>
      ) : null}

      {/* ---------------------------------------------------- ringkasan */}
      {hasData ? (
        <>
          <section
            className={`${tab === "ringkasan" ? "block" : "hidden"} space-y-3 lg:block`}
          >
            <HeroCard
              metrics={metrics}
              today={hariIni}
              syncing={syncing}
              onSync={() => void refresh("recalc")}
              onReports={() => setTab("riwayat")}
            />

            <StatPills
              items={[
                {
                  label: "Omzet",
                  value: metrics.totalOmzet,
                  hint: `${angka(metrics.cupsSold)} cup`,
                },
                {
                  label: "HPP terpakai",
                  value: metrics.totalHpp,
                  hint: `${rupiah(metrics.avgCogsPerCup)}/cup`,
                },
                {
                  label: "OPEX",
                  value: metrics.totalOpex,
                  hint: "di luar bahan",
                },
              ]}
            />

            {snapshot.warnings.length > 0 ? (
              <Notice tone="warning">
                {snapshot.warnings.length === 1
                  ? snapshot.warnings[0]
                  : `${snapshot.warnings.length} transaksi memakai stok yang batch-nya belum diinput. Cek tab Riwayat › Penjualan.`}
              </Notice>
            ) : null}

            <RevenueChart
              data={chart}
              bulan={namaBulan()}
              proyeksiAkhirBulan={proyeksi}
            />
          </section>

          {/* ------------------------------------------------------- stok */}
          <section
            className={`${tab === "stok" ? "block" : "hidden"} mt-0 space-y-3 lg:mt-3 lg:block`}
          >
            <BatchQueue
              batches={snapshot.batches}
              onDelete={(id) => handleDelete("batch", id)}
            />
          </section>
        </>
      ) : null}

      {/* -------------------------------------------------------- input */}
      <section
        className={`${tab === "input" ? "block" : "hidden"} mt-0 space-y-4 lg:mt-4 lg:block`}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <SaleForm
            batches={snapshot.batches}
            defaultPrice={metrics.avgPricePerCup || 15000}
            onSubmit={handleSubmit("sale", "Input penjualan")}
          />
          <BatchForm onSubmit={handleSubmit("batch", "Input batch belanja")} />
          <ExpenseForm
            onSubmit={handleSubmit("expense", "Input pengeluaran")}
          />
        </div>
      </section>

      {/* ------------------------------------------------------------ PO */}
      <section
        className={`${tab === "po" ? "block" : "hidden"} mt-0 space-y-4 lg:mt-4 lg:block`}
      >
        <PoBoard onChanged={() => void refresh("read")} />
      </section>

      {/* ------------------------------------------------------- riwayat */}
      {hasData ? (
        <section
          className={`${tab === "riwayat" ? "block" : "hidden"} mt-0 space-y-4 lg:mt-4 lg:block`}
        >
          <HistoryTable
            snapshot={snapshot}
            onDelete={(kind, id) => handleDelete(kind, id)}
          />
        </section>
      ) : null}

      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {/* ------------------------------------------ bottom nav (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-20 bg-card/95 shadow-[0_-2px_16px_-6px_rgba(43,27,18,0.25)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-5xl items-end">
          {NAV_LEFT.map((item) => (
            <NavItem
              key={item.key}
              item={item}
              active={tab}
              onSelect={setTab}
            />
          ))}

          <div className="flex flex-1 justify-center">
            <button
              type="button"
              onClick={() => setTab("input")}
              aria-label="Input transaksi"
              aria-current={tab === "input" ? "page" : undefined}
              className={`-mt-6 grid h-14 w-14 place-items-center rounded-full text-white shadow-[0_8px_20px_-6px_rgba(200,95,25,0.9)] transition active:scale-95 ${
                tab === "input" ? "bg-mango-deep" : "bg-mango"
              }`}
            >
              <Plus className="h-6 w-6" aria-hidden />
            </button>
          </div>

          {NAV_RIGHT.map((item) => (
            <NavItem
              key={item.key}
              item={item}
              active={tab}
              onSelect={setTab}
            />
          ))}
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </div>
  );
}

function NavItem({
  item,
  active,
  onSelect,
}: {
  item: { key: Tab; label: string; Icon: typeof BarChart3 };
  active: Tab;
  onSelect: (tab: Tab) => void;
}) {
  const { key, label, Icon } = item;
  return (
    <button
      type="button"
      onClick={() => onSelect(key)}
      aria-current={active === key ? "page" : undefined}
      className={`flex flex-1 flex-col items-center gap-0.5 py-3 text-[11px] font-semibold transition ${
        active === key ? "text-mango-deep" : "text-ink/45"
      }`}
    >
      <Icon className="h-5 w-5" aria-hidden />
      {label}
    </button>
  );
}

/** "Sabtu, 22 Agu" — tanggal hari ini seperti di header aplikasi kasir. */
function hariIniLabel(): string {
  return new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

/** Data untuk membuat ulang baris yang baru saja dihapus (tombol "Urungkan"). */
function restorePayload(
  kind: EntityKind,
  id: string,
  snapshot: ReturnType<typeof useDashboard>["snapshot"],
): Record<string, unknown> | null {
  if (kind === "sale") {
    const s = snapshot.sales.find((row) => row.id === id);
    return s
      ? {
          date: s.date,
          cups: s.cups,
          pricePerCup: s.pricePerCup,
          channel: s.channel,
          note: s.note,
        }
      : null;
  }
  if (kind === "batch") {
    const b = snapshot.batches.find((row) => row.id === id);
    return b
      ? {
          date: b.date,
          itemName: b.itemName,
          totalCost: b.totalCost,
          yieldCup: b.yieldCup,
          note: b.note,
        }
      : null;
  }
  const e = snapshot.expenses.find((row) => row.id === id);
  return e
    ? { date: e.date, category: e.category, amount: e.amount, note: e.note }
    : null;
}
