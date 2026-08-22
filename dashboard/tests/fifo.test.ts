import assert from 'node:assert/strict';
import { test } from 'node:test';
import { previewAllocation, runFifo } from '../lib/fifo.ts';
import { computeBep, computeChart, computeDaily, computeMetrics, healthOf } from '../lib/metrics.ts';
import type { Batch, Expense, Sale } from '../lib/types.ts';

const batch = (id: string, date: string, totalCost: number, yieldCup: number): Batch => ({
  id,
  date,
  itemName: `Batch ${id}`,
  totalCost,
  yieldCup,
  createdAt: `${date}T08:00:00.000Z`,
});

const sale = (id: string, date: string, cups: number, pricePerCup: number): Sale => ({
  id,
  date,
  cups,
  pricePerCup,
  createdAt: `${date}T10:00:00.000Z`,
});

const expense = (id: string, date: string, amount: number): Expense => ({
  id,
  date,
  category: 'Es Batu',
  amount,
  createdAt: `${date}T10:00:00.000Z`,
});

test('batch tertua dipakai duluan dan berubah jadi DEPLETED saat habis', () => {
  const batches = [batch('b2', '2026-08-05', 200_000, 40), batch('b1', '2026-08-01', 100_000, 20)];
  const result = runFifo(batches, [sale('s1', '2026-08-06', 20, 15_000)]);

  const b1 = result.batches.find((b) => b.id === 'b1')!;
  const b2 = result.batches.find((b) => b.id === 'b2')!;

  assert.equal(b1.status, 'DEPLETED');
  assert.equal(b1.usedCup, 20);
  assert.equal(b1.remainingValue, 0);
  assert.equal(b2.status, 'ACTIVE');
  assert.equal(b2.usedCup, 0);
  assert.equal(result.sales[0].cogs, 100_000);
});

test('penjualan melintasi dua batch: sisa kekurangan diambil dari batch berikutnya', () => {
  const batches = [batch('b1', '2026-08-01', 100_000, 20), batch('b2', '2026-08-05', 200_000, 40)];
  const result = runFifo(batches, [sale('s1', '2026-08-06', 30, 15_000)]);

  const s = result.sales[0];
  assert.equal(s.allocations.length, 2);
  assert.deepEqual(
    s.allocations.map((a) => [a.batchId, a.cups, a.cost]),
    [
      ['b1', 20, 100_000],
      ['b2', 10, 50_000],
    ],
  );
  assert.equal(s.cogs, 150_000);
  assert.equal(s.revenue, 450_000);
  assert.equal(s.grossProfit, 300_000);
  assert.equal(result.batches.find((b) => b.id === 'b2')!.remainingCup, 30);
});

test('pembulatan tidak menumpuk: total HPP satu batch persis sama dengan biaya belanja', () => {
  // 100.000 / 3 cup = 33.333,33 -> tanpa penanganan khusus, 3 x Math.round = 99.999.
  const batches = [batch('b1', '2026-08-01', 100_000, 3)];
  const sales = [
    sale('s1', '2026-08-01', 1, 15_000),
    sale('s2', '2026-08-02', 1, 15_000),
    sale('s3', '2026-08-03', 1, 15_000),
  ];
  const result = runFifo(batches, sales);
  const totalHpp = result.sales.reduce((sum, s) => sum + s.cogs, 0);

  assert.equal(totalHpp, 100_000);
  assert.ok(result.sales.every((s) => Number.isInteger(s.cogs)));
  assert.equal(result.batches[0].status, 'DEPLETED');
  assert.equal(result.batches[0].remainingValue, 0);
});

test('stok kurang: transaksi tetap tercatat dan diberi peringatan', () => {
  const result = runFifo([batch('b1', '2026-08-01', 100_000, 10)], [sale('s1', '2026-08-02', 15, 15_000)]);

  assert.equal(result.sales[0].shortageCups, 5);
  assert.equal(result.warnings.length, 1);
  assert.equal(result.sales[0].cogs, 100_000 + 5 * 10_000);
});

test('urutan konsumsi mengikuti tanggal penjualan, bukan urutan input', () => {
  const batches = [batch('b1', '2026-08-01', 100_000, 10), batch('b2', '2026-08-02', 300_000, 10)];
  const sales = [sale('s2', '2026-08-10', 10, 15_000), sale('s1', '2026-08-03', 10, 15_000)];
  const result = runFifo(batches, sales);

  const first = result.sales.find((s) => s.id === 's1')!;
  const second = result.sales.find((s) => s.id === 's2')!;
  assert.equal(first.cogs, 100_000);
  assert.equal(second.cogs, 300_000);
});

test('preview alokasi memakai sisa stok terkini', () => {
  const fifo = runFifo(
    [batch('b1', '2026-08-01', 100_000, 20), batch('b2', '2026-08-05', 200_000, 40)],
    [sale('s1', '2026-08-06', 15, 15_000)],
  );
  const preview = previewAllocation(fifo.batches, 10);

  assert.equal(preview.shortageCups, 0);
  assert.deepEqual(
    preview.allocations.map((a) => [a.batchId, a.cups]),
    [
      ['b1', 5],
      ['b2', 5],
    ],
  );
  assert.equal(preview.cogs, 25_000 + 25_000);
});

test('metrik keuangan dan health badge', () => {
  const fifo = runFifo([batch('b1', '2026-08-01', 100_000, 20)], [sale('s1', '2026-08-02', 20, 15_000)]);
  const metrics = computeMetrics(fifo.batches, fifo.sales, [expense('e1', '2026-08-02', 50_000)]);

  assert.equal(metrics.totalOmzet, 300_000);
  assert.equal(metrics.totalHpp, 100_000);
  assert.equal(metrics.totalOpex, 50_000);
  assert.equal(metrics.grossProfit, 200_000);
  assert.equal(metrics.netProfit, 150_000);
  assert.equal(metrics.netMargin, 50);
  assert.equal(metrics.health, 'SEHAT');

  assert.equal(healthOf(40), 'SEHAT');
  assert.equal(healthOf(39.9), 'WASPADA');
  assert.equal(healthOf(20), 'WASPADA');
  assert.equal(healthOf(19.9), 'KRITIS');
});

test('BEP: target modal batch aktif + OPEX', () => {
  const fifo = runFifo(
    [batch('b1', '2026-08-01', 100_000, 20), batch('b2', '2026-08-05', 200_000, 40)],
    [sale('s1', '2026-08-06', 20, 15_000)],
  );
  const metrics = computeMetrics(fifo.batches, fifo.sales, [expense('e1', '2026-08-06', 40_000)]);
  const bep = computeBep(fifo.batches, metrics);

  // b1 habis -> tinggal b2 (200.000) + OPEX 40.000 = 240.000.
  assert.equal(bep.targetCost, 240_000);
  assert.equal(bep.marginPerCup, 15_000 - 5_000);
  assert.equal(bep.bepCups, 24);
  assert.equal(bep.cupsSold, 20);
  assert.equal(bep.progress, 83);
  assert.equal(bep.reached, false);
});

test('grafik kumulatif + proyeksi akhir bulan', () => {
  const fifo = runFifo(
    [batch('b1', '2026-08-01', 100_000, 100)],
    [sale('s1', '2026-08-01', 10, 15_000), sale('s2', '2026-08-02', 10, 15_000)],
  );
  const daily = computeDaily(fifo.sales, [expense('e1', '2026-08-01', 20_000)]);
  const chart = computeChart(daily, new Date(2026, 7, 2, 12));

  assert.equal(chart.length, 31);
  assert.equal(chart[0].omzet, 150_000);
  assert.equal(chart[1].omzet, 300_000);
  assert.equal(chart[0].pengeluaran, 10_000 + 20_000);
  // Hari ke-3 dan seterusnya belum terjadi -> hanya garis proyeksi.
  assert.equal(chart[2].omzet, null);
  assert.equal(chart[30].proyeksi, Math.round((300_000 / 2) * 31));
});
