import type {
  Allocation,
  Batch,
  BatchState,
  FifoResult,
  Sale,
  SaleComputed,
} from './types';

/**
 * FIFO Engine.
 *
 * Prinsipnya: alokasi stok TIDAK pernah disimpan sebagai state permanen, tapi
 * selalu dihitung ulang dari nol berdasarkan seluruh batch + seluruh penjualan
 * yang ada. Konsekuensinya, kalau ada baris yang diedit manual langsung di
 * Google Sheets (atau dihapus lewat dashboard), status batch dan HPP tiap
 * transaksi otomatis benar lagi tanpa perlu migrasi data apa pun.
 */

/** Urutan FIFO: tanggal belanja paling awal duluan, lalu urutan input. */
export function compareBatch(a: Batch, b: Batch): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Urutan konsumsi stok: penjualan paling awal memotong batch paling awal. */
export function compareSale(a: Sale, b: Sale): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** HPP tampilan per cup (integer rupiah). */
export function costPerCup(batch: Batch): number {
  if (batch.yieldCup <= 0) return 0;
  return Math.round(batch.totalCost / batch.yieldCup);
}

/**
 * Biaya rupiah untuk `qty` cup berikutnya dari sebuah batch.
 *
 * Dihitung sebagai selisih dua nilai kumulatif yang dibulatkan, bukan
 * `costPerCup * qty`. Efeknya: pembulatan tidak pernah menumpuk — kalau satu
 * batch habis terpakai, jumlah seluruh potongan HPP-nya persis sama dengan
 * total biaya belanja batch tersebut (tidak ada sisa Rp 1 yang menggantung).
 */
function costForCups(batch: Batch, alreadyUsed: number, qty: number): number {
  if (batch.yieldCup <= 0 || qty <= 0) return 0;
  const before = Math.round((batch.totalCost * alreadyUsed) / batch.yieldCup);
  const after = Math.round((batch.totalCost * (alreadyUsed + qty)) / batch.yieldCup);
  return after - before;
}

/** HPP cadangan per cup dipakai kalau stok batch kurang (batch belum diinput). */
function fallbackCostPerCup(batches: Batch[]): number {
  const usable = batches.filter((b) => b.yieldCup > 0);
  if (usable.length === 0) return 0;
  const last = usable[usable.length - 1];
  return costPerCup(last);
}

/**
 * Jalankan seluruh penjualan terhadap seluruh batch memakai aturan FIFO.
 *
 * - Penjualan N cup memotong batch `ACTIVE` bertanggal paling awal.
 * - Kalau N melebihi sisa batch tersebut, batch dihabiskan (jadi `DEPLETED`)
 *   dan sisa kekurangannya otomatis diambil dari batch aktif berikutnya,
 *   berlanjut sampai N terpenuhi.
 * - HPP transaksi = gabungan biaya seluruh batch yang terpakai.
 */
export function runFifo(batches: Batch[], sales: Sale[]): FifoResult {
  const warnings: string[] = [];
  const ordered = [...batches].sort(compareBatch);
  const used = new Map<string, number>(ordered.map((b) => [b.id, 0]));
  const fallback = fallbackCostPerCup(ordered);

  let cursor = 0; // batch pertama yang mungkin masih punya sisa stok

  const computedSales: SaleComputed[] = [...sales].sort(compareSale).map((sale) => {
    const cups = Math.max(0, Math.round(sale.cups));
    const pricePerCup = Math.round(sale.pricePerCup);
    const revenue = Math.round(cups * pricePerCup);

    const allocations: Allocation[] = [];
    let remainingToServe = cups;
    let cogs = 0;

    while (remainingToServe > 0 && cursor < ordered.length) {
      const batch = ordered[cursor];
      const alreadyUsed = used.get(batch.id) ?? 0;
      const available = Math.max(0, batch.yieldCup - alreadyUsed);

      if (available <= 0) {
        cursor += 1;
        continue;
      }

      const take = Math.min(available, remainingToServe);
      const cost = costForCups(batch, alreadyUsed, take);

      allocations.push({
        batchId: batch.id,
        batchDate: batch.date,
        itemName: batch.itemName,
        cups: take,
        cost,
      });

      used.set(batch.id, alreadyUsed + take);
      cogs += cost;
      remainingToServe -= take;

      // Batch habis persis di transaksi ini -> lanjut ke batch berikutnya.
      if (alreadyUsed + take >= batch.yieldCup) cursor += 1;
    }

    const shortageCups = remainingToServe;
    if (shortageCups > 0) {
      const cost = Math.round(fallback * shortageCups);
      cogs += cost;
      allocations.push({
        batchId: '-',
        batchDate: sale.date,
        itemName: 'Stok batch belum tercatat',
        cups: shortageCups,
        cost,
      });
      warnings.push(
        `Penjualan ${sale.date} (${cups} cup): stok batch kurang ${shortageCups} cup. ` +
          `HPP kekurangan dipakai estimasi Rp ${fallback.toLocaleString('id-ID')}/cup — segera input batch belanjanya.`,
      );
    }

    return {
      ...sale,
      cups,
      pricePerCup,
      revenue,
      cogs,
      grossProfit: revenue - cogs,
      allocations,
      shortageCups,
    };
  });

  const batchStates: BatchState[] = ordered.map((batch) => {
    const usedCup = used.get(batch.id) ?? 0;
    const remainingCup = Math.max(0, batch.yieldCup - usedCup);
    const consumedValue = costForCups(batch, 0, usedCup);
    return {
      ...batch,
      costPerCup: costPerCup(batch),
      usedCup,
      remainingCup,
      remainingValue: Math.max(0, batch.totalCost - consumedValue),
      status: remainingCup > 0 ? 'ACTIVE' : 'DEPLETED',
    };
  });

  return { batches: batchStates, sales: computedSales, warnings };
}

/**
 * Simulasi alokasi FIFO untuk N cup terhadap sisa stok saat ini — dipakai
 * form penjualan buat menampilkan estimasi HPP & laba sebelum tombol simpan
 * ditekan. Tidak mengubah state apa pun.
 */
export function previewAllocation(
  batches: BatchState[],
  cups: number,
): { allocations: Allocation[]; cogs: number; shortageCups: number } {
  const ordered = [...batches].sort(compareBatch);
  const allocations: Allocation[] = [];
  let remaining = Math.max(0, Math.round(cups));
  let cogs = 0;

  for (const batch of ordered) {
    if (remaining <= 0) break;
    const available = Math.max(0, batch.yieldCup - batch.usedCup);
    if (available <= 0) continue;

    const take = Math.min(available, remaining);
    const cost = costForCups(batch, batch.usedCup, take);
    allocations.push({
      batchId: batch.id,
      batchDate: batch.date,
      itemName: batch.itemName,
      cups: take,
      cost,
    });
    cogs += cost;
    remaining -= take;
  }

  if (remaining > 0) {
    const fallback = fallbackCostPerCup(ordered);
    cogs += Math.round(fallback * remaining);
  }

  return { allocations, cogs, shortageCups: remaining };
}
