import { Target } from 'lucide-react';
import { angka, rupiah } from '@/lib/format';
import type { BepInfo } from '@/lib/types';

/** Progres cup terjual terhadap titik balik modal (batch aktif + OPEX). */
export default function BepProgress({ bep }: { bep: BepInfo }) {
  const belumBisaDihitung = bep.bepCups === null;
  const progress = Math.min(100, Math.max(0, bep.progress));

  return (
    <section className="card">
      <header className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-cheese/15 text-cheese">
            <Target className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h2 className="text-base leading-tight font-bold text-ink">Break Even Point</h2>
            <p className="text-xs text-ink/55">
              Modal balik: belanja batch aktif + operasional
            </p>
          </div>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
            bep.reached ? 'bg-good-soft text-good' : 'bg-ink/5 text-ink/70'
          }`}
        >
          {belumBisaDihitung ? '—' : `${progress}%`}
        </span>
      </header>

      <div
        className="h-3 w-full overflow-hidden rounded-full bg-ink/10"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progres break even point"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${
            bep.reached ? 'bg-good' : 'bg-mango'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <Item label="Target modal" value={rupiah(bep.targetCost)} />
        <Item label="Margin per cup" value={rupiah(bep.marginPerCup)} />
        <Item
          label="Cup BEP"
          value={belumBisaDihitung ? 'Belum terhitung' : `${angka(bep.bepCups ?? 0)} cup`}
        />
        <Item label="Sudah terjual" value={`${angka(bep.cupsSold)} cup`} />
      </dl>

      <p className="mt-3 text-xs text-ink/60">
        {belumBisaDihitung
          ? 'Isi minimal 1 batch belanja dan 1 penjualan supaya margin per cup bisa dihitung.'
          : bep.reached
            ? `Modal sudah balik. Setiap cup berikutnya menambah laba bersih ${rupiah(bep.marginPerCup)}.`
            : `Kurang ${angka(bep.cupsToGo ?? 0)} cup lagi buat balik modal.`}
      </p>
    </section>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-well px-3 py-2">
      <dt className="text-xs text-ink/55">{label}</dt>
      <dd className="font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}
