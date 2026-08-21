'use client';

import { useMemo, useState } from 'react';
import { CupSoda, Loader2 } from 'lucide-react';
import { previewAllocation } from '@/lib/fifo';
import { angka, rupiah, todayISO } from '@/lib/format';
import type { BatchState } from '@/lib/types';
import { Field, FormCard, Notice, NumberInput, QuickPicks } from './ui';

interface Props {
  batches: BatchState[];
  defaultPrice: number;
  onSubmit: (payload: Record<string, unknown>) => Promise<{ ok: boolean; queued: boolean }>;
}

/** Form POS: input cup terjual -> otomatis memicu alokasi FIFO di server. */
export default function SaleForm({ batches, defaultPrice, onSubmit }: Props) {
  const [date, setDate] = useState(todayISO());
  const [cups, setCups] = useState('');
  const [price, setPrice] = useState(String(defaultPrice || 15000));
  const [channel, setChannel] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'warning' | 'error'; text: string } | null>(null);

  const cupsNum = Math.max(0, Math.round(Number(cups) || 0));
  const priceNum = Math.max(0, Math.round(Number(price) || 0));

  // Estimasi HPP dihitung di browser memakai engine FIFO yang sama dengan server.
  const preview = useMemo(() => previewAllocation(batches, cupsNum), [batches, cupsNum]);
  const omzet = Math.round(cupsNum * priceNum);
  const labaKotor = omzet - preview.cogs;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (cupsNum <= 0 || priceNum <= 0) {
      setFeedback({ tone: 'error', text: 'Jumlah cup dan harga jual wajib diisi.' });
      return;
    }

    setBusy(true);
    const result = await onSubmit({
      date,
      cups: cupsNum,
      pricePerCup: priceNum,
      channel: channel || undefined,
      note: note || undefined,
    });
    setBusy(false);

    if (!result.ok) {
      setFeedback({ tone: 'error', text: 'Gagal menyimpan penjualan. Cek pesan error di atas.' });
      return;
    }

    setFeedback({
      tone: result.queued ? 'warning' : 'success',
      text: result.queued
        ? `${cupsNum} cup tersimpan di HP. Otomatis dikirim ke Google Sheets saat sinyal kembali.`
        : `${cupsNum} cup tercatat. Laba kotor transaksi ${rupiah(labaKotor)}.`,
    });
    setCups('');
    setNote('');
  };

  return (
    <FormCard
      title="Input Penjualan"
      description="Stok terpotong otomatis dari batch paling lama (FIFO)"
      icon={
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-mango/10 text-mango-deep">
          <CupSoda className="h-4 w-4" aria-hidden />
        </span>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Tanggal" htmlFor="sale-date">
          <input
            id="sale-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="field"
          />
        </Field>

        <Field label="Cup terjual" htmlFor="sale-cups">
          <NumberInput
            id="sale-cups"
            value={cups}
            onChange={setCups}
            placeholder="0"
            suffix="cup"
          />
          <QuickPicks
            values={[1, 5, 10, 20, 50]}
            onPick={(v) => setCups(String(Math.max(0, Math.round(Number(cups) || 0)) + v))}
            format={(v) => `+${v}`}
          />
        </Field>

        <Field label="Harga jual per cup" htmlFor="sale-price">
          <NumberInput
            id="sale-price"
            value={price}
            onChange={setPrice}
            placeholder="15000"
            prefix="Rp"
            step={500}
          />
          <QuickPicks values={[12000, 15000, 18000, 20000]} onPick={(v) => setPrice(String(v))} format={(v) => angka(v)} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Channel" htmlFor="sale-channel">
            <select
              id="sale-channel"
              value={channel}
              onChange={(event) => setChannel(event.target.value)}
              className="field"
            >
              <option value="">—</option>
              <option value="Booth">Booth</option>
              <option value="Pre-order">Pre-order</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Titip Jual">Titip Jual</option>
            </select>
          </Field>
          <Field label="Catatan" htmlFor="sale-note">
            <input
              id="sale-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="opsional"
              className="field"
            />
          </Field>
        </div>

        <dl className="grid grid-cols-3 gap-2 rounded-xl bg-ivory px-3 py-3 text-center">
          <Preview label="Omzet" value={rupiah(omzet)} />
          <Preview label="HPP FIFO" value={rupiah(preview.cogs)} />
          <Preview
            label="Laba kotor"
            value={rupiah(labaKotor)}
            tone={labaKotor < 0 ? 'danger' : 'good'}
          />
        </dl>

        {preview.shortageCups > 0 && cupsNum > 0 ? (
          <Notice tone="warning">
            Sisa stok batch kurang {angka(preview.shortageCups)} cup. Transaksi tetap bisa dicatat,
            tapi input dulu batch belanjanya biar HPP-nya akurat.
          </Notice>
        ) : null}

        {preview.allocations.length > 0 ? (
          <ul className="space-y-1 text-xs text-coffee/60">
            {preview.allocations.map((a) => (
              <li key={`${a.batchId}-${a.cups}`} className="flex justify-between gap-2">
                <span className="truncate">
                  {a.cups} cup dari batch {a.batchDate} · {a.itemName}
                </span>
                <span className="tabular-nums">{rupiah(a.cost)}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {feedback ? <Notice tone={feedback.tone}>{feedback.text}</Notice> : null}

        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {busy ? 'Menyimpan…' : 'Catat Penjualan'}
        </button>
      </form>
    </FormCard>
  );
}

function Preview({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'good' | 'danger';
}) {
  const tones = {
    neutral: 'text-coffee',
    good: 'text-emerald-700',
    danger: 'text-red-700',
  } as const;
  return (
    <div>
      <dt className="text-[11px] tracking-wide text-coffee/55 uppercase">{label}</dt>
      <dd className={`text-sm font-extrabold tabular-nums ${tones[tone]}`}>{value}</dd>
    </div>
  );
}
