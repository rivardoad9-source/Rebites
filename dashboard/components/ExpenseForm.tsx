'use client';

import { useState } from 'react';
import { Loader2, Wallet } from 'lucide-react';
import { angka, rupiah, todayISO } from '@/lib/format';
import { EXPENSE_CATEGORIES, type ExpenseCategory } from '@/lib/types';
import { Field, FormCard, Notice, NumberInput, QuickPicks } from './ui';

interface Props {
  onSubmit: (payload: Record<string, unknown>) => Promise<{ ok: boolean; queued: boolean }>;
}

/** Form pengeluaran operasional (OPEX) di luar bahan baku. */
export default function ExpenseForm({ onSubmit }: Props) {
  const [date, setDate] = useState(todayISO());
  const [category, setCategory] = useState<ExpenseCategory>('Es Batu');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'warning' | 'error'; text: string } | null>(null);

  const nominal = Math.max(0, Math.round(Number(amount) || 0));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (nominal <= 0) {
      setFeedback({ tone: 'error', text: 'Nominal pengeluaran wajib diisi.' });
      return;
    }

    setBusy(true);
    const result = await onSubmit({ date, category, amount: nominal, note: note || undefined });
    setBusy(false);

    if (!result.ok) {
      setFeedback({ tone: 'error', text: 'Gagal menyimpan pengeluaran. Cek pesan error di atas.' });
      return;
    }

    setFeedback({
      tone: result.queued ? 'warning' : 'success',
      text: result.queued
        ? 'Pengeluaran tersimpan di HP, otomatis dikirim saat sinyal kembali.'
        : `${category} ${rupiah(nominal)} tercatat.`,
    });
    setAmount('');
    setNote('');
  };

  return (
    <FormCard
      title="Input Pengeluaran (OPEX)"
      description="Biaya operasional di luar bahan baku"
      icon={
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-cheese/15 text-cheese">
          <Wallet className="h-4 w-4" aria-hidden />
        </span>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Tanggal" htmlFor="expense-date">
          <input
            id="expense-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="field"
          />
        </Field>

        <Field label="Kategori" htmlFor="expense-category">
          <select
            id="expense-category"
            value={category}
            onChange={(event) => setCategory(event.target.value as ExpenseCategory)}
            className="field"
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Nominal" htmlFor="expense-amount">
          <NumberInput
            id="expense-amount"
            value={amount}
            onChange={setAmount}
            placeholder="15000"
            prefix="Rp"
            step={1000}
          />
          <QuickPicks
            values={[5000, 10000, 20000, 50000]}
            onPick={(v) => setAmount(String(v))}
            format={(v) => angka(v)}
          />
        </Field>

        <Field label="Catatan" htmlFor="expense-note">
          <input
            id="expense-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="opsional — mis. es batu 2 balok"
            className="field"
          />
        </Field>

        {feedback ? <Notice tone={feedback.tone}>{feedback.text}</Notice> : null}

        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {busy ? 'Menyimpan…' : 'Simpan Pengeluaran'}
        </button>
      </form>
    </FormCard>
  );
}
