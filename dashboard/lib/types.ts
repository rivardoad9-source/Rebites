/**
 * Tipe data inti Mango Cheese Realtime Dashboard & POS.
 *
 * Semua nominal rupiah disimpan sebagai integer (tanpa desimal) supaya tidak
 * pernah muncul error floating point ala 0.1 + 0.2 = 0.30000000000000004.
 */

/** Tanggal format `YYYY-MM-DD` (zona waktu lokal booth). */
export type ISODate = string;

export { EXPENSE_CATEGORIES } from './parse';
export type { ExpenseCategory } from './parse';

import type { ExpenseCategory } from './parse';

export type BatchStatus = 'ACTIVE' | 'DEPLETED';

/** Satu batch belanja bahan baku (input mentah dari UI / Google Sheets). */
export interface Batch {
  id: string;
  date: ISODate;
  itemName: string;
  /** Total biaya belanja batch dalam rupiah (integer). */
  totalCost: number;
  /** Estimasi jumlah cup yang bisa dihasilkan batch ini. */
  yieldCup: number;
  note?: string;
  createdAt: string;
}

/** Satu transaksi penjualan harian (input mentah). */
export interface Sale {
  id: string;
  date: ISODate;
  cups: number;
  /** Harga jual per cup dalam rupiah (integer). */
  pricePerCup: number;
  channel?: string;
  note?: string;
  createdAt: string;
}

/** Satu pengeluaran operasional (OPEX). */
export interface Expense {
  id: string;
  date: ISODate;
  category: ExpenseCategory;
  /** Nominal rupiah (integer). */
  amount: number;
  note?: string;
  createdAt: string;
}

/** Potongan stok dari satu batch untuk satu transaksi penjualan. */
export interface Allocation {
  batchId: string;
  batchDate: ISODate;
  itemName: string;
  cups: number;
  /** HPP rupiah untuk porsi cup yang diambil dari batch ini. */
  cost: number;
}

/** Batch setelah dijalankan lewat FIFO engine. */
export interface BatchState extends Batch {
  costPerCup: number;
  usedCup: number;
  remainingCup: number;
  /** Sisa nilai rupiah stok batch (belum terjual). */
  remainingValue: number;
  status: BatchStatus;
}

/** Penjualan setelah dijalankan lewat FIFO engine. */
export interface SaleComputed extends Sale {
  revenue: number;
  cogs: number;
  grossProfit: number;
  allocations: Allocation[];
  /** Cup yang terjual tapi tidak ada batch-nya (stok kurang / batch belum diinput). */
  shortageCups: number;
}

export interface FifoResult {
  batches: BatchState[];
  sales: SaleComputed[];
  /** Peringatan non-fatal, mis. stok batch tidak mencukupi. */
  warnings: string[];
}

export type HealthLevel = 'SEHAT' | 'WASPADA' | 'KRITIS';

export interface Metrics {
  totalOmzet: number;
  totalHpp: number;
  totalOpex: number;
  grossProfit: number;
  netProfit: number;
  /** Net margin dalam persen (0 - 100), sudah dibulatkan 1 desimal. */
  netMargin: number;
  grossMargin: number;
  cupsSold: number;
  avgPricePerCup: number;
  avgCogsPerCup: number;
  health: HealthLevel;
  stockRemainingCup: number;
  stockRemainingValue: number;
}

export interface ChartPoint {
  /** Tanggal dalam bulan (1..31). */
  day: number;
  label: string;
  omzet: number | null;
  pengeluaran: number | null;
  proyeksi: number | null;
}

export interface DailyRow {
  date: ISODate;
  cups: number;
  omzet: number;
  hpp: number;
  opex: number;
  grossProfit: number;
  netProfit: number;
}

export interface Snapshot {
  generatedAt: string;
  /** `sheets` = data live dari Google Sheets, `local` = fallback penyimpanan lokal. */
  source: 'sheets' | 'local';
  batches: BatchState[];
  sales: SaleComputed[];
  expenses: Expense[];
  metrics: Metrics;
  chart: ChartPoint[];
  daily: DailyRow[];
  warnings: string[];
}
