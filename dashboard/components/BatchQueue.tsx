'use client';

import { Layers, Trash2 } from 'lucide-react';
import { angka, rupiah, tanggal } from '@/lib/format';
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
        <p className="rounded-xl bg-well px-3 py-6 text-center text-sm text-ink/55">
          Belum ada batch belanja. Input batch dulu supaya HPP penjualan bisa dihitung.
        </p>
      ) : (
        <ul className="space-y-2">
          {antrean.map((batch, index) => {
            const terpakai =
              batch.yieldCup > 0 ? Math.round((batch.usedCup / batch.yieldCup) * 100) : 0;
            const berikutnya = batch.status === 'ACTIVE' && aktif[0]?.id === batch.id;

            return (
              <li key={batch.id} className="rounded-xl border border-ink/10 bg-well/60 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-bold text-ink">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink/10 text-[11px]">
                        {index + 1}
                      </span>
                      <span className="truncate">{batch.itemName}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-ink/55">
                      {tanggal(batch.date)} · {rupiah(batch.totalCost)} / {angka(batch.yieldCup)} cup
                      · HPP {rupiah(batch.costPerCup)}/cup
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        batch.status === 'ACTIVE'
                          ? 'bg-good-soft text-good'
                          : 'bg-ink/10 text-ink/55'
                      }`}
                    >
                      {batch.status === 'ACTIVE' ? 'ACTIVE' : 'DEPLETED'}
                    </span>
                    {onDelete ? (
                      <button
                        type="button"
                        onClick={() => onDelete(batch.id)}
                        className="rounded-lg p-1.5 text-ink/40 transition hover:bg-bad-soft hover:text-bad"
                        aria-label={`Hapus batch ${batch.itemName}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
                  <div
                    className={`h-full rounded-full ${
                      batch.status === 'ACTIVE' ? 'bg-mango' : 'bg-ink/30'
                    }`}
                    style={{ width: `${Math.min(100, terpakai)}%` }}
                  />
                </div>
                <p className="mt-1 flex justify-between text-[11px] text-ink/55">
                  <span>
                    Terpakai {angka(batch.usedCup)} / {angka(batch.yieldCup)} cup
                  </span>
                  <span>
                    Sisa nilai {rupiah(batch.remainingValue)}
                    {berikutnya ? ' · dipakai berikutnya' : ''}
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
