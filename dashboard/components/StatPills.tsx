import { rupiah, rupiahShort } from '@/lib/format';

/** Tiga angka pendukung dalam satu baris pil, seperti ringkasan di app kasir. */
export default function StatPills({
  items,
}: {
  items: { label: string; value: number; hint?: string }[];
}) {
  return (
    <section className="card grid grid-cols-3 divide-x divide-ink/8 px-2 py-3">
      {items.map((item) => (
        <div key={item.label} className="px-2 text-center">
          <p
            className="text-base leading-tight font-extrabold tabular-nums text-ink sm:text-lg"
            title={rupiah(item.value)}
          >
            {rupiahShort(item.value)}
          </p>
          <p className="mt-0.5 text-[11px] leading-tight text-ink/55">{item.label}</p>
          {item.hint ? <p className="text-[10px] text-ink/40">{item.hint}</p> : null}
        </div>
      ))}
    </section>
  );
}
