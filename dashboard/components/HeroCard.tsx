'use client';

import { useEffect, useState } from 'react';
import { BarChart3, Eye, EyeOff, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { persen, rupiah, tanggal } from '@/lib/format';
import type { DailyRow, Metrics } from '@/lib/types';

const HIDE_KEY = 'mango-pos:hide-amount:v1';

/**
 * Kartu utama bergaya "saldo dompet": laba bersih ditaruh sebesar mungkin,
 * dengan perubahan hari ini di sebelahnya. Nominal bisa disembunyikan sekali
 * ketuk — berguna waktu HP kelihatan pembeli di depan booth.
 */
export default function HeroCard({
  metrics,
  today,
  syncing,
  onSync,
  onReports,
}: {
  metrics: Metrics;
  today: DailyRow | null;
  syncing: boolean;
  onSync: () => void;
  onReports: () => void;
}) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try {
      setHidden(window.localStorage.getItem(HIDE_KEY) === '1');
    } catch {
      setHidden(false);
    }
  }, []);

  const toggle = () => {
    const next = !hidden;
    setHidden(next);
    try {
      window.localStorage.setItem(HIDE_KEY, next ? '1' : '0');
    } catch {
      // Mode privat — cukup berlaku sesi ini.
    }
  };

  const sehat = metrics.netProfit >= 0;
  const Delta = (today?.netProfit ?? 0) < 0 ? TrendingDown : TrendingUp;
  const nominal = (value: number) => (hidden ? '••••••' : rupiah(value));

  return (
    <section className="card-hero">
      {/* Lingkaran samar di latar, meniru kartu saldo pada aplikasi dompet. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-10 h-44 w-44 rounded-full bg-white/12"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-8 h-40 w-40 rounded-full bg-black/8"
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em] text-white/75 uppercase">
              Laba bersih
            </p>
            <p className="mt-1 text-3xl leading-none font-extrabold tabular-nums sm:text-4xl">
              {nominal(metrics.netProfit)}
            </p>
          </div>
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold whitespace-nowrap backdrop-blur">
            {sehat ? 'Margin' : 'Rugi'} {persen(metrics.netMargin)}
          </span>
        </div>

        <p className="mt-2 flex items-center gap-1.5 text-sm text-white/85">
          <Delta className="h-4 w-4" aria-hidden />
          {today ? (
            <>
              <span className="font-semibold tabular-nums">{nominal(today.netProfit)}</span>
              <span className="text-white/65">· {tanggal(today.date)}</span>
            </>
          ) : (
            <span className="text-white/65">Belum ada transaksi hari ini</span>
          )}
        </p>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={onReports}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white/18 px-4 py-3 text-sm font-bold backdrop-blur transition active:scale-[0.99]"
          >
            <BarChart3 className="h-4 w-4" aria-hidden />
            Lihat Laporan
          </button>
          <button
            type="button"
            onClick={onSync}
            disabled={syncing}
            aria-label="Sinkronkan dengan Google Sheets"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/18 backdrop-blur transition active:scale-95 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} aria-hidden />
          </button>
          <button
            type="button"
            onClick={toggle}
            aria-label={hidden ? 'Tampilkan nominal' : 'Sembunyikan nominal'}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/18 backdrop-blur transition active:scale-95"
          >
            {hidden ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      </div>
    </section>
  );
}
