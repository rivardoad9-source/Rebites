'use client';

import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { angka, rupiah, tanggal } from '@/lib/format';
import { Field, Notice, NumberInput, QuickPicks } from './ui';

/** Satu pesanan di tab PO spreadsheet. */
interface PoOrder {
  rowNumber: number;
  nomor: string;
  nama: string;
  cups: number;
  pricePerCup: number;
  total: number;
  status: string;
  lunas: boolean;
  notes: string;
}

interface Board {
  tab: string;
  date: string | null;
  orders: PoOrder[];
  totalCups: number;
  totalBayar: number;
  lunasCups: number;
  belumCups: number;
}

/**
 * Papan catatan PO: cerminan tab "List PO" di spreadsheet, dengan kolom yang
 * sama persis. Mau catat dari sini atau langsung di Sheets, ujungnya sama —
 * setiap perubahan diringkas ulang jadi baris penjualan.
 */
export default function PoBoard({ onChanged }: { onChanged?: () => void }) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nama, setNama] = useState('');
  const [cups, setCups] = useState('1');
  const [price, setPrice] = useState('15000');
  const [lunas, setLunas] = useState(true);
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/po', { cache: 'no-store' });
      const body = (await response.json()) as {
        ok?: boolean;
        enabled?: boolean;
        boards?: Board[];
        error?: string;
      };
      if (!body.ok) {
        setError(body.error ?? 'Gagal memuat catatan PO.');
        return;
      }
      setEnabled(body.enabled !== false);
      setBoards(body.boards ?? []);
      setActive((current) => current ?? body.boards?.[0]?.tab ?? null);
      setError(null);
    } catch {
      setError('Tidak bisa menghubungi server. Catatan PO butuh koneksi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const send = useCallback(
    async (init: RequestInit & { url?: string }) => {
      setBusy(true);
      setError(null);
      try {
        const response = await fetch(init.url ?? '/api/po', {
          ...init,
          headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
        });
        const body = (await response.json()) as { ok?: boolean; error?: string; boards?: Board[] };
        if (!body.ok) {
          setError(body.error ?? 'Perubahan gagal disimpan.');
          return false;
        }
        if (body.boards) setBoards(body.boards);
        onChanged?.();
        return true;
      } catch {
        setError('Tidak bisa menghubungi server. Coba lagi setelah sinyal stabil.');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [onChanged],
  );

  const board = boards.find((b) => b.tab === active) ?? boards[0] ?? null;

  const tambahPesanan = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!board) return;
    if (!nama.trim()) {
      setError('Nama pemesan wajib diisi.');
      return;
    }

    const okSent = await send({
      method: 'POST',
      body: JSON.stringify({
        tab: board.tab,
        nama: nama.trim(),
        cups: Math.max(1, Math.round(Number(cups) || 0)),
        pricePerCup: Math.max(1, Math.round(Number(price) || 0)),
        lunas,
        notes: notes.trim() || undefined,
      }),
    });

    if (okSent) {
      setNama('');
      setCups('1');
      setNotes('');
    }
  };

  const batchBaru = async () => {
    const title = window.prompt('Nama batch baru (mis. "BATCH 4 30 Agustus drop")');
    if (!title) return;
    const okSent = await send({
      method: 'POST',
      body: JSON.stringify({ action: 'create-board', tab: title }),
    });
    if (okSent) setActive(title.trim().slice(0, 60));
  };

  if (!loading && !enabled) {
    return (
      <section className="card">
        <Header />
        <Notice tone="warning">
          Catatan PO tersimpan langsung di spreadsheet, jadi tab ini aktif setelah dashboard
          tersambung ke Google Sheets. Isi dulu GOOGLE_SHEET_ID, GOOGLE_CLIENT_EMAIL, dan
          GOOGLE_PRIVATE_KEY di environment variable.
        </Notice>
      </section>
    );
  }

  return (
    <section className="card">
      <Header
        action={
          <button type="button" onClick={() => void load()} className="btn-ghost px-2.5" aria-label="Muat ulang">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          </button>
        }
      />

      {error ? (
        <div className="mb-3">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap gap-2">
        {boards.map((b) => (
          <button
            key={b.tab}
            type="button"
            onClick={() => setActive(b.tab)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              board?.tab === b.tab
                ? 'border-brand bg-brand/10 text-brand-deep'
                : 'border-ink/15 bg-field text-ink/70'
            }`}
          >
            {b.tab}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void batchBaru()}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-ink/25 px-3 py-1.5 text-xs font-semibold text-ink/60"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Batch baru
        </button>
      </div>

      {loading && boards.length === 0 ? (
        <p className="rounded-xl bg-well px-3 py-6 text-center text-sm text-ink/55">Memuat…</p>
      ) : null}

      {board ? (
        <>
          <dl className="mb-3 grid grid-cols-3 gap-2 rounded-xl bg-well px-3 py-2 text-center">
            <Stat label="Total cup" value={angka(board.totalCups)} />
            <Stat label="Lunas" value={`${angka(board.lunasCups)} cup`} tone="good" />
            <Stat label="Belum" value={`${angka(board.belumCups)} cup`} tone="warn" />
          </dl>
          <p className="mb-3 text-center text-sm font-bold text-ink">
            {rupiah(board.totalBayar)}
            {board.date ? (
              <span className="ml-2 text-xs font-normal text-ink/50">drop {tanggal(board.date)}</span>
            ) : null}
          </p>

          <ul className="mb-4 space-y-2">
            {board.orders.length === 0 ? (
              <li className="rounded-xl bg-well px-3 py-6 text-center text-sm text-ink/55">
                Belum ada pesanan di batch ini.
              </li>
            ) : (
              board.orders.map((order) => (
                <li
                  key={`${board.tab}-${order.rowNumber}`}
                  className="rounded-xl border border-ink/10 bg-well/60 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-ink">
                        {order.nomor ? `${order.nomor}. ` : ''}
                        {order.nama}
                      </p>
                      <p className="text-xs text-ink/55">
                        {angka(order.cups)} cup × {rupiah(order.pricePerCup)} ={' '}
                        <span className="font-semibold text-ink/75">{rupiah(order.total)}</span>
                      </p>
                      {order.notes ? (
                        <p className="mt-1 text-xs text-ink/50">{order.notes}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void send({
                            method: 'PATCH',
                            body: JSON.stringify({
                              tab: board.tab,
                              rowNumber: order.rowNumber,
                              lunas: !order.lunas,
                            }),
                          })
                        }
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                          order.lunas ? 'bg-good-soft text-good' : 'bg-warn-soft text-warn'
                        }`}
                      >
                        {order.lunas ? 'Lunas' : 'Belum'}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (!window.confirm(`Hapus pesanan ${order.nama}?`)) return;
                          void send({
                            method: 'DELETE',
                            url: `/api/po?tab=${encodeURIComponent(board.tab)}&row=${order.rowNumber}`,
                          });
                        }}
                        aria-label={`Hapus pesanan ${order.nama}`}
                        className="rounded-lg p-1.5 text-ink/40 transition hover:bg-bad-soft hover:text-bad"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>

          <form onSubmit={tambahPesanan} className="space-y-3 border-t border-ink/10 pt-4">
            <Field label="Nama pemesan" htmlFor="po-nama">
              <input
                id="po-nama"
                value={nama}
                onChange={(event) => setNama(event.target.value)}
                placeholder="mis. Steve Salim"
                className="field"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Jumlah cup" htmlFor="po-cups">
                <NumberInput id="po-cups" value={cups} onChange={setCups} suffix="cup" />
              </Field>
              <Field label="Harga per cup" htmlFor="po-price">
                <NumberInput id="po-price" value={price} onChange={setPrice} prefix="Rp" />
              </Field>
            </div>
            <QuickPicks values={[14000, 15000, 18000]} onPick={(v) => setPrice(String(v))} format={(v) => angka(v)} />

            <Field label="Catatan" htmlFor="po-notes">
              <input
                id="po-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="opsional — mis. mangga jangan yang asem"
                className="field"
              />
            </Field>

            <div className="flex gap-2">
              {[true, false].map((value) => (
                <button
                  key={String(value)}
                  type="button"
                  onClick={() => setLunas(value)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    lunas === value
                      ? 'border-brand bg-brand/10 text-brand-deep'
                      : 'border-ink/15 bg-field text-ink/60'
                  }`}
                >
                  {value ? 'Lunas' : 'Belum bayar'}
                </button>
              ))}
            </div>

            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
              {busy ? 'Menyimpan…' : 'Tambah Pesanan'}
            </button>
            <p className="text-center text-xs text-ink/50">
              Tersimpan langsung ke tab {board.tab} di spreadsheet, dan otomatis masuk hitungan
              penjualan begitu statusnya Lunas.
            </p>
          </form>
        </>
      ) : null}
    </section>
  );
}

function Header({ action }: { action?: React.ReactNode }) {
  return (
    <header className="mb-3 flex items-start justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand/10 text-brand-deep">
          <ClipboardList className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <h2 className="text-base leading-tight font-bold text-ink">Catatan PO</h2>
          <p className="text-xs text-ink/55">Format sama dengan tab PO di spreadsheet</p>
        </div>
      </div>
      {action}
    </header>
  );
}

function Stat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'good' | 'warn';
}) {
  const tones = { neutral: 'text-ink', good: 'text-good', warn: 'text-warn' } as const;
  return (
    <div>
      <dt className="text-[11px] tracking-wide text-ink/55 uppercase">{label}</dt>
      <dd className={`text-sm font-extrabold tabular-nums ${tones[tone]}`}>{value}</dd>
    </div>
  );
}
