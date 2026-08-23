'use client';

import { Layers, Trash2 } from 'lucide-react';
import { angka, rupiah, rupiahShort, tanggal } from '@/lib/format';
import type { BatchState } from '@/lib/types';

/** Antrean stok FIFO: batch paling atas = yang dipakai berikutnya. */
export default function BatchQueue({
  batches,
  onDelete,
}: {
  batches: BatchState[];
  onDelete?: (id: string) => void;
}) {
  // `batches` datang urut terbaru dulu; antrean FIFO dibalik jadi terlama dulu.
  const antrean = [...batches].reverse();
  const aktif = antrean.filter((b) => b.status === 'ACTIVE');

  return (
    <section className="card">
      <header className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-leaf/10 text-leaf">
            <Layers className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h2 className="text-base leading-tight font-bold text-ink">Antrean Stok FIFO</h2>
            <p className="text-xs text-ink/55">
              {aktif.length} batch aktif ·{' '}
              {angka(aktif.reduce((sum, b) => sum + b.remainingCup, 0))} cup tersisa
            </p>
          </div>
        </div>
      </header>

      {antrean.length === 0 ? (
        <p className="card-inset py-6 text-center text-sm text-ink/55">
          Belum ada batch belanja. Input batch dulu supaya HPP penjualan bisa dihitung.
        </p>
      ) : (
        <ul className="space-y-2">
          {antrean.map((batch, index) => {
            const terpakai =
              batch.yieldCup > 0 ? Math.round((batch.usedCup / batch.yieldCup) * 100) : 0;
            const berikutnya = batch.status === 'ACTIVE' && aktif[0]?.id === batch.id;

            return (
              <li key={batch.id} className="card-inset">
                <div className="flex items-start gap-3">
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-extrabold ${
                      batch.status === 'ACTIVE'
                        ? 'bg-brand/15 text-brand-deep'
                        : 'bg-ink/8 text-ink/40'
                    }`}
                  >
                    {index + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-bold text-ink">{batch.itemName}</p>
                      <p className="shrink-0 text-sm font-extrabold tabular-nums text-ink">
                        {rupiah(batch.totalCost)}
                      </p>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-xs text-ink/55">
                        {tanggal(batch.date)} · HPP {rupiah(batch.costPerCup)}/cup
                      </p>
                      <p className="shrink-0 text-xs text-ink/55">
                        {angka(batch.usedCup)}/{angka(batch.yieldCup)} cup
                      </p>
                    </div>
                  </div>

                  {onDelete ? (
                    <button
                      type="button"
                      onClick={() => onDelete(batch.id)}
                      className="-mr-1 shrink-0 rounded-lg p-1.5 text-ink/35 transition hover:bg-bad-soft hover:text-bad"
                      aria-label={`Hapus batch ${batch.itemName}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  ) : null}
                </div>

                <div className="mt-2 ml-12 h-1.5 overflow-hidden rounded-full bg-ink/10">
                  <div
                    className={`h-full rounded-full ${
                      batch.status === 'ACTIVE' ? 'bg-brand' : 'bg-ink/30'
                    }`}
                    style={{ width: `${Math.min(100, terpakai)}%` }}
                  />
                </div>
                <p className="mt-1 ml-12 flex items-center justify-between gap-2 text-[11px]">
                  <span className="flex items-center gap-1">
                    <span
                      className={`rounded-full px-2 py-0.5 font-bold ${
                        batch.status === 'ACTIVE' ? 'bg-good-soft text-good' : 'bg-ink/8 text-ink/45'
                      }`}
                    >
                      {batch.status === 'ACTIVE' ? 'ACTIVE' : 'DEPLETED'}
                    </span>
                    {berikutnya ? (
                      <span className="rounded-full bg-brand/12 px-2 py-0.5 font-bold text-brand-deep">
                        dipakai berikutnya
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-ink/55">
                    Sisa {rupiahShort(batch.remainingValue)}
                  </span>
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
