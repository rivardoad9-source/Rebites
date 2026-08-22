'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deriveSnapshot } from '@/lib/derive';
import type { Batch, Expense, Sale, Snapshot } from '@/lib/types';

/**
 * State manager dashboard.
 *
 * Tiga hal yang bikin ini aman dipakai di booth dengan sinyal jelek:
 *  1. Snapshot terakhir di-cache di localStorage -> layar langsung terisi
 *     angka lama begitu halaman dibuka, tanpa nunggu jaringan.
 *  2. Setiap input yang gagal terkirim masuk antrean (localStorage) dan
 *     dikirim ulang otomatis begitu koneksi balik.
 *  3. Angka dashboard dihitung ulang di browser memakai FIFO engine yang sama
 *     persis dengan server, jadi hasil "offline" tidak pernah beda rumus.
 */

const RAW_KEY = 'mango-pos:raw:v1';
const QUEUE_KEY = 'mango-pos:queue:v1';
const META_KEY = 'mango-pos:meta:v1';

export type EntityKind = 'sale' | 'batch' | 'expense';

export interface RawState {
  batches: Batch[];
  sales: Sale[];
  expenses: Expense[];
  source: 'sheets' | 'local';
}

export interface QueuedMutation {
  key: string;
  kind: EntityKind;
  op: 'create' | 'delete';
  /** Body request untuk `create`, atau `{ id }` untuk `delete`. */
  payload: Record<string, unknown>;
  /** Entitas optimistis yang ditampilkan sebelum server mengonfirmasi. */
  entity?: Batch | Sale | Expense;
  targetId?: string;
  label: string;
  createdAt: string;
}

const emptyRaw: RawState = { batches: [], sales: [], expenses: [], source: 'local' };

const ENDPOINT: Record<EntityKind, string> = {
  sale: '/api/sales',
  batch: '/api/batches',
  expense: '/api/expenses',
};

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage penuh / mode privat — abaikan, data tetap ada di memori.
  }
}

function localId(prefix: string): string {
  return `local_${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Terapkan antrean offline ke data server supaya UI terasa instan. */
function applyQueue(raw: RawState, queue: QueuedMutation[]): RawState {
  let batches = [...raw.batches];
  let sales = [...raw.sales];
  let expenses = [...raw.expenses];

  for (const item of queue) {
    if (item.op === 'create' && item.entity) {
      if (item.kind === 'batch') batches = [...batches, item.entity as Batch];
      if (item.kind === 'sale') sales = [...sales, item.entity as Sale];
      if (item.kind === 'expense') expenses = [...expenses, item.entity as Expense];
    }
    if (item.op === 'delete' && item.targetId) {
      if (item.kind === 'batch') batches = batches.filter((b) => b.id !== item.targetId);
      if (item.kind === 'sale') sales = sales.filter((s) => s.id !== item.targetId);
      if (item.kind === 'expense') expenses = expenses.filter((e) => e.id !== item.targetId);
    }
  }

  return { ...raw, batches, sales, expenses };
}

function rawFromSnapshot(snapshot: Snapshot): RawState {
  return {
    source: snapshot.source,
    batches: snapshot.batches.map((b) => ({
      id: b.id,
      date: b.date,
      itemName: b.itemName,
      totalCost: b.totalCost,
      yieldCup: b.yieldCup,
      note: b.note,
      createdAt: b.createdAt,
    })),
    sales: snapshot.sales.map((s) => ({
      id: s.id,
      date: s.date,
      cups: s.cups,
      pricePerCup: s.pricePerCup,
      channel: s.channel,
      note: s.note,
      createdAt: s.createdAt,
    })),
    expenses: snapshot.expenses.map((e) => ({ ...e })),
  };
}

interface ApiResult {
  ok: boolean;
  error?: string;
  snapshot?: Snapshot;
}

async function callApi(
  url: string,
  init: RequestInit,
): Promise<{ status: number; body: ApiResult }> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    cache: 'no-store',
  });
  let body: ApiResult = { ok: response.ok };
  try {
    body = (await response.json()) as ApiResult;
  } catch {
    body = { ok: response.ok, error: 'Response server tidak terbaca.' };
  }
  return { status: response.status, body };
}

export function useDashboard() {
  const [raw, setRaw] = useState<RawState>(emptyRaw);
  const [queue, setQueue] = useState<QueuedMutation[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const flushing = useRef(false);

  /* ------------------------------------------------- hidrasi cache lokal */
  useEffect(() => {
    setRaw(readStorage<RawState>(RAW_KEY, emptyRaw));
    setQueue(readStorage<QueuedMutation[]>(QUEUE_KEY, []));
    setLastSyncedAt(readStorage<{ lastSyncedAt: string | null }>(META_KEY, { lastSyncedAt: null }).lastSyncedAt);
    setOnline(typeof navigator === 'undefined' ? true : navigator.onLine);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) writeStorage(RAW_KEY, raw);
  }, [raw, hydrated]);

  useEffect(() => {
    if (hydrated) writeStorage(QUEUE_KEY, queue);
  }, [queue, hydrated]);

  useEffect(() => {
    if (hydrated) writeStorage(META_KEY, { lastSyncedAt });
  }, [lastSyncedAt, hydrated]);

  const acceptSnapshot = useCallback((snapshot: Snapshot) => {
    setRaw(rawFromSnapshot(snapshot));
    setLastSyncedAt(snapshot.generatedAt);
    setError(null);
    setOnline(true);
  }, []);

  /* ------------------------------------------------------------ refresh */
  const refresh = useCallback(
    async (mode: 'read' | 'recalc' = 'read') => {
      setSyncing(true);
      try {
        const { status, body } =
          mode === 'recalc'
            ? await callApi('/api/sync', { method: 'POST', body: JSON.stringify({}) })
            : await callApi('/api/sync', { method: 'GET' });

        if (body.ok && body.snapshot) {
          acceptSnapshot(body.snapshot);
          return true;
        }
        setError(body.error ?? `Server membalas status ${status}.`);
        return false;
      } catch {
        setOnline(false);
        setError('Koneksi ke server gagal — dashboard memakai data cache lokal.');
        return false;
      } finally {
        setSyncing(false);
        setLoading(false);
      }
    },
    [acceptSnapshot],
  );

  /* ------------------------------------------------- kirim ulang antrean */
  const flushQueue = useCallback(async (): Promise<boolean> => {
    if (flushing.current) return false;
    const pending = readStorage<QueuedMutation[]>(QUEUE_KEY, []);
    if (pending.length === 0) return true;

    flushing.current = true;
    let allSent = true;

    try {
      for (const item of pending) {
        try {
          const { status, body } =
            item.op === 'create'
              ? await callApi(ENDPOINT[item.kind], {
                  method: 'POST',
                  body: JSON.stringify(item.payload),
                })
              : await callApi(`${ENDPOINT[item.kind]}?id=${encodeURIComponent(item.targetId ?? '')}`, {
                  method: 'DELETE',
                });

          if (body.ok) {
            setQueue((current) => current.filter((q) => q.key !== item.key));
            if (body.snapshot) acceptSnapshot(body.snapshot);
            continue;
          }

          if (status >= 400 && status < 500) {
            // Ditolak server (validasi/data hilang) — buang dari antrean,
            // percuma dikirim ulang terus.
            setQueue((current) => current.filter((q) => q.key !== item.key));
            setError(`${item.label} ditolak server: ${body.error ?? 'data tidak valid'}.`);
            continue;
          }

          allSent = false;
          setError(body.error ?? 'Server sedang bermasalah, input tetap tersimpan di antrean.');
          break;
        } catch {
          allSent = false;
          setOnline(false);
          break;
        }
      }
    } finally {
      flushing.current = false;
    }

    return allSent;
  }, [acceptSnapshot]);

  /* ---------------------------------------------------------- mutations */
  const enqueue = useCallback((item: QueuedMutation) => {
    setQueue((current) => [...current, item]);
  }, []);

  const submit = useCallback(
    async (kind: EntityKind, payload: Record<string, unknown>, label: string) => {
      const now = new Date().toISOString();
      const entity = buildOptimisticEntity(kind, payload, now);
      const item: QueuedMutation = {
        key: localId('mut'),
        kind,
        op: 'create',
        payload,
        entity,
        label,
        createdAt: now,
      };

      // Tampilkan dulu (optimistis), baru urus jaringan.
      enqueue(item);

      try {
        const { status, body } = await callApi(ENDPOINT[kind], {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        if (body.ok && body.snapshot) {
          setQueue((current) => current.filter((q) => q.key !== item.key));
          acceptSnapshot(body.snapshot);
          return { ok: true as const, queued: false };
        }

        if (status >= 400 && status < 500) {
          setQueue((current) => current.filter((q) => q.key !== item.key));
          setError(body.error ?? 'Input ditolak server.');
          return { ok: false as const, queued: false, error: body.error };
        }

        setError(body.error ?? 'Server bermasalah — input masuk antrean kirim ulang.');
        return { ok: true as const, queued: true };
      } catch {
        setOnline(false);
        setError('Offline — input tersimpan di HP dan otomatis dikirim saat sinyal kembali.');
        return { ok: true as const, queued: true };
      }
    },
    [acceptSnapshot, enqueue],
  );

  const remove = useCallback(
    async (kind: EntityKind, id: string, label: string) => {
      const item: QueuedMutation = {
        key: localId('mut'),
        kind,
        op: 'delete',
        payload: { id },
        targetId: id,
        label,
        createdAt: new Date().toISOString(),
      };
      enqueue(item);

      try {
        const { status, body } = await callApi(
          `${ENDPOINT[kind]}?id=${encodeURIComponent(id)}`,
          { method: 'DELETE' },
        );
        if (body.ok && body.snapshot) {
          setQueue((current) => current.filter((q) => q.key !== item.key));
          acceptSnapshot(body.snapshot);
          return { ok: true as const, queued: false };
        }
        if (status >= 400 && status < 500) {
          setQueue((current) => current.filter((q) => q.key !== item.key));
          setError(body.error ?? 'Hapus data ditolak server.');
          return { ok: false as const, queued: false };
        }
        return { ok: true as const, queued: true };
      } catch {
        setOnline(false);
        return { ok: true as const, queued: true };
      }
    },
    [acceptSnapshot, enqueue],
  );

  /* ------------------------------------------------- pemuatan & polling */
  useEffect(() => {
    if (!hydrated) return;
    void (async () => {
      await flushQueue();
      await refresh('read');
    })();
  }, [hydrated, flushQueue, refresh]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const goOnline = () => {
      setOnline(true);
      void (async () => {
        await flushQueue();
        await refresh('read');
      })();
    };
    const goOffline = () => setOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    // Polling ringan supaya perubahan manual di Google Sheets ikut kelihatan.
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return;
      void (async () => {
        const sent = await flushQueue();
        if (sent) await refresh('read');
      })();
    }, 45_000);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.clearInterval(timer);
    };
  }, [flushQueue, refresh]);

  const snapshot = useMemo(
    () => deriveSnapshot(applyQueue(raw, queue), new Date()),
    [raw, queue],
  );

  return {
    snapshot,
    loading,
    syncing,
    error,
    online,
    pending: queue,
    lastSyncedAt,
    hasData:
      snapshot.batches.length > 0 || snapshot.sales.length > 0 || snapshot.expenses.length > 0,
    refresh,
    submit,
    remove,
    flushQueue,
    dismissError: () => setError(null),
  };
}

function buildOptimisticEntity(
  kind: EntityKind,
  payload: Record<string, unknown>,
  now: string,
): Batch | Sale | Expense {
  const num = (v: unknown) => Math.round(Number(v ?? 0)) || 0;
  const date = (payload.date ?? now.slice(0, 10)).toString();

  if (kind === 'batch') {
    return {
      id: localId('bch'),
      date,
      itemName: (payload.itemName ?? 'Bahan baku').toString(),
      totalCost: num(payload.totalCost),
      yieldCup: num(payload.yieldCup),
      note: payload.note ? payload.note.toString() : undefined,
      createdAt: now,
    } satisfies Batch;
  }

  if (kind === 'sale') {
    return {
      id: localId('sal'),
      date,
      cups: num(payload.cups),
      pricePerCup: num(payload.pricePerCup),
      channel: payload.channel ? payload.channel.toString() : undefined,
      note: payload.note ? payload.note.toString() : undefined,
      createdAt: now,
    } satisfies Sale;
  }

  return {
    id: localId('exp'),
    date,
    category: (payload.category ?? 'Lainnya') as Expense['category'],
    amount: num(payload.amount),
    note: payload.note ? payload.note.toString() : undefined,
    createdAt: now,
  } satisfies Expense;
}
