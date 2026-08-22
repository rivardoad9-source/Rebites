import { runFifo } from './fifo';
import { computeChart, computeDaily, computeMetrics } from './metrics';
import type { Batch, Expense, Sale, Snapshot } from './types';

export interface DeriveInput {
  batches: Batch[];
  sales: Sale[];
  expenses: Expense[];
  source: 'sheets' | 'local';
}

/**
 * Fungsi murni: data mentah -> seluruh angka dashboard.
 *
 * Sengaja tidak menyentuh I/O apa pun supaya bisa dipakai dua sisi — server
 * (setelah baca Google Sheets) dan browser (untuk hitung ulang optimistis
 * saat koneksi di booth putus).
 */
export function deriveSnapshot(input: DeriveInput, now = new Date()): Snapshot {
  const fifo = runFifo(input.batches, input.sales);
  const expenses = [...input.expenses];

  const metrics = computeMetrics(fifo.batches, fifo.sales, expenses);
  const daily = computeDaily(fifo.sales, expenses);
  const chart = computeChart(daily, now);

  return {
    generatedAt: now.toISOString(),
    source: input.source,
    // Riwayat ditampilkan dari yang terbaru.
    batches: [...fifo.batches].reverse(),
    sales: [...fifo.sales].reverse(),
    expenses: expenses.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    metrics,
    chart,
    daily: [...daily].reverse(),
    warnings: fifo.warnings,
  };
}
