'use client';

import { useState } from 'react';
import { Loader2, PackagePlus } from 'lucide-react';
import { rupiah, todayISO } from '@/lib/format';
import { Field, FormCard, Notice, NumberInput, QuickPicks } from './ui';

interface Props {
  onSubmit: (payload: Record<string, unknown>) => Promise<{ ok: boolean; queued: boolean }>;
}

/** Form belanja bahan baku per batch. HPP per cup dihitung otomatis. */
export default function BatchForm({ onSubmit }: Props) {
  const [date, setDate] = useState(todayISO());
  const [itemName, setItemName] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [yieldCup, setYieldCup] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'warning' | 'error'; text: string } | null>(null);

  const cost = Math.max(0, Math.round(Number(totalCost) || 0));
  const cups = Math.max(0, Math.round(Number(yieldCup) || 0));
  const costPerCup = cups > 0 ? Math.round(cost / cups) : 0;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!itemName.trim() || cost <= 0 || cups <= 0) {
      setFeedback({ tone: 'error', text: 'Nama item, total biaya, dan yield cup wajib diisi.' });
      return;
    }

    setBusy(true);
    const result = await onSubmit({
      date,
      itemName: itemName.trim(),
      totalCost: cost,
      yieldCup: cups,
      note: note || undefined,
    });
    setBusy(false);

    if (!result.ok) {
      setFeedback({ tone: 'error', text: 'Gagal menyimpan batch. Cek pesan error di atas.' });
      return;
    }

    setFeedback({
      tone: result.queued ? 'warning' : 'success',
      text: result.queued
        ? 'Batch tersimpan di HP, otomatis dikirim saat sinyal kembali.'
        : `Batch masuk antrean FIFO. HPP ${rupiah(costPerCup)} per cup.`,
    });
    setItemName('');
    setTotalCost('');
    setYieldCup('');
    setNote('');
  };

  return (
    <FormCard
      title="Input Belanja Batch"
      description="Batch paling lama otomatis dipakai duluan saat ada penjualan"
      icon={
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-leaf/10 text-leaf">
          <PackagePlus className="h-4 w-4" aria-hidden />
        </span>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Tanggal belanja" htmlFor="batch-date">
          <input
            id="batch-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="field"
          />
        </Field>

        <Field label="Nama item bahan" htmlFor="batch-item">
          <input
            id="batch-item"
            value={itemName}
            onChange={(event) => setItemName(event.target.value)}
            placeholder="Mangga + cream cheese + susu"
            className="field"
          />
          <QuickPicks
            values={[0, 1, 2, 3]}
            onPick={(index) =>
              setItemName(
                ['Paket bahan lengkap', 'Mangga harum manis', 'Cream cheese & susu', 'Cup + sedotan'][index],
              )
            }
            format={(index) =>
              ['Paket lengkap', 'Mangga', 'Cheese & susu', 'Cup & sedotan'][index]
            }
          />
        </Field>

        <Field label="Total biaya belanja" htmlFor="batch-cost">
          <NumberInput
            id="batch-cost"
            value={totalCost}
            onChange={setTotalCost}
            placeholder="250000"
            prefix="Rp"
            step={1000}
          />
        </Field>

        <Field label="Estimasi yield" htmlFor="batch-yield" hint="Perkiraan jumlah cup jadi dari batch ini">
          <NumberInput
            id="batch-yield"
            value={yieldCup}
            onChange={setYieldCup}
            placeholder="40"
            suffix="cup"
          />
        </Field>

        <Field label="Catatan" htmlFor="batch-note">
          <input
            id="batch-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="opsional — mis. beli di Pasar Induk"
            className="field"
          />
        </Field>

        <div className="rounded-xl bg-ivory px-3 py-3 text-center">
          <p className="text-[11px] tracking-wide text-coffee/55 uppercase">HPP per cup</p>
          <p className="text-lg font-extrabold tabular-nums text-coffee">{rupiah(costPerCup)}</p>
          <p className="text-xs text-coffee/55">
            {cups > 0 ? `${rupiah(cost)} ÷ ${cups} cup` : 'Isi total biaya dan yield cup'}
          </p>
        </div>

        {feedback ? <Notice tone={feedback.tone}>{feedback.text}</Notice> : null}

        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {busy ? 'Menyimpan…' : 'Simpan Batch'}
        </button>
      </form>
    </FormCard>
  );
}
