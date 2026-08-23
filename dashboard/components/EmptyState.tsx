'use client';

import { ArrowRight, PackagePlus, Sparkles } from 'lucide-react';

/** Panduan singkat saat dashboard masih kosong. */
export default function EmptyState({ onStart }: { onStart: () => void }) {
  const steps = [
    'Input batch belanja bahan baku — total biaya + perkiraan jumlah cup.',
    'Catat penjualan harian; stok terpotong otomatis dari batch tertua.',
    'Tambahkan pengeluaran operasional biar laba bersihnya jujur.',
  ];

  return (
    <section className="card text-center">
      <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-brand-deep">
        <PackagePlus className="h-6 w-6" aria-hidden />
      </span>
      <h2 className="text-lg font-extrabold text-ink">Mulai dari batch pertama</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-ink/60">
        Belum ada data. Tiga langkah ini bikin seluruh metrik — HPP, laba kotor, laba bersih —
        langsung hidup.
      </p>

      <ol className="mx-auto mt-4 max-w-sm space-y-2 text-left">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-2 rounded-xl bg-well px-3 py-2 text-sm text-ink/75">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand/15 text-[11px] font-bold text-brand-deep">
              {index + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>

      <button type="button" onClick={onStart} className="btn-primary mt-4 sm:w-auto sm:px-6">
        <Sparkles className="h-4 w-4" aria-hidden />
        Input data pertama
        <ArrowRight className="h-4 w-4" aria-hidden />
      </button>
    </section>
  );
}
