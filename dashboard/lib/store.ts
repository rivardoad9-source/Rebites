import { promises as fs } from 'fs';
import path from 'path';
import { runFifo, costPerCup } from './fifo';
import {
  SHEET_TABS,
  appendRow,
  deleteRow,
  findRowNumber,
  isSheetsConfigured,
  readRows,
  rewriteRows,
  updateRow,
} from './sheets';
import { newId, normalizeCategory, normalizeDate, parseCount, parseRupiah } from './parse';
import type { Batch, Expense, Sale } from './types';

/**
 * Satu-satunya pintu masuk data.
 *
 * Kalau kredensial Google Sheets tersedia -> baca/tulis langsung ke spreadsheet.
 * Kalau belum -> fallback ke penyimpanan lokal (file `.data/db.json`, atau memori
 * proses kalau filesystem read-only) supaya dashboard tetap jalan waktu demo,
 * saat setup awal, atau saat kredensial bermasalah di tengah jualan.
 */

export { newId, normalizeCategory, normalizeDate, parseCount, parseRupiah };

export interface RawData {
  batches: Batch[];
  sales: Sale[];
  expenses: Expense[];
  source: 'sheets' | 'local';
}

/* ------------------------------------------------------- baris <-> objek */

function rowToBatch(row: string[]): Batch | null {
  const id = (row[0] ?? '').trim();
  const itemName = (row[2] ?? '').trim();
  if (!id && !itemName) return null;
  return {
    id: id || newId('bch'),
    date: normalizeDate(row[1]),
    itemName: itemName || 'Bahan baku',
    totalCost: parseRupiah(row[3]),
    yieldCup: Math.max(0, parseCount(row[4])),
    note: (row[9] ?? '').trim() || undefined,
    createdAt: (row[10] ?? '').trim() || `${normalizeDate(row[1])}T00:00:00.000Z`,
  };
}

function rowToSale(row: string[]): Sale | null {
  const id = (row[0] ?? '').trim();
  const cups = parseCount(row[2]);
  if (!id && cups === 0) return null;
  return {
    id: id || newId('sal'),
    date: normalizeDate(row[1]),
    cups: Math.max(0, cups),
    pricePerCup: parseRupiah(row[3]),
    channel: (row[7] ?? '').trim() || undefined,
    note: (row[8] ?? '').trim() || undefined,
    createdAt: (row[9] ?? '').trim() || `${normalizeDate(row[1])}T00:00:00.000Z`,
  };
}

function rowToExpense(row: string[]): Expense | null {
  const id = (row[0] ?? '').trim();
  const amount = parseRupiah(row[3]);
  if (!id && amount === 0) return null;
  return {
    id: id || newId('exp'),
    date: normalizeDate(row[1]),
    category: normalizeCategory(row[2]),
    amount,
    note: (row[4] ?? '').trim() || undefined,
    createdAt: (row[5] ?? '').trim() || `${normalizeDate(row[1])}T00:00:00.000Z`,
  };
}

export function batchToRow(
  batch: Batch,
  derived?: { usedCup: number; remainingCup: number; status: string },
): (string | number)[] {
  return [
    batch.id,
    batch.date,
    batch.itemName,
    batch.totalCost,
    batch.yieldCup,
    costPerCup(batch),
    derived?.usedCup ?? 0,
    derived?.remainingCup ?? batch.yieldCup,
    derived?.status ?? 'ACTIVE',
    batch.note ?? '',
    batch.createdAt,
  ];
}

export function saleToRow(
  sale: Sale,
  derived?: { cogs: number; grossProfit: number },
): (string | number)[] {
  const revenue = Math.round(sale.cups * sale.pricePerCup);
  return [
    sale.id,
    sale.date,
    sale.cups,
    sale.pricePerCup,
    revenue,
    derived?.cogs ?? 0,
    derived?.grossProfit ?? revenue,
    sale.channel ?? '',
    sale.note ?? '',
    sale.createdAt,
  ];
}

export function expenseToRow(expense: Expense): (string | number)[] {
  return [
    expense.id,
    expense.date,
    expense.category,
    expense.amount,
    expense.note ?? '',
    expense.createdAt,
  ];
}

/* ------------------------------------------------------- local fallback */

const LOCAL_FILE = path.join(process.cwd(), '.data', 'db.json');

interface LocalDb {
  batches: Batch[];
  sales: Sale[];
  expenses: Expense[];
}

const emptyDb = (): LocalDb => ({ batches: [], sales: [], expenses: [] });

const memory = globalThis as unknown as { __mangoDb?: LocalDb };

async function readLocal(): Promise<LocalDb> {
  if (memory.__mangoDb) return memory.__mangoDb;
  try {
    const raw = await fs.readFile(LOCAL_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<LocalDb>;
    memory.__mangoDb = {
      batches: parsed.batches ?? [],
      sales: parsed.sales ?? [],
      expenses: parsed.expenses ?? [],
    };
  } catch {
    memory.__mangoDb = emptyDb();
  }
  return memory.__mangoDb;
}

async function writeLocal(db: LocalDb): Promise<void> {
  memory.__mangoDb = db;
  try {
    await fs.mkdir(path.dirname(LOCAL_FILE), { recursive: true });
    await fs.writeFile(LOCAL_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch {
    // Filesystem read-only (mis. serverless) -> cukup simpan di memori proses.
  }
}

/* ------------------------------------------------------------ operasi data */

export async function readAll(): Promise<RawData> {
  if (isSheetsConfigured()) {
    const [batchRows, saleRows, expenseRows] = await Promise.all([
      readRows(SHEET_TABS.batches),
      readRows(SHEET_TABS.sales),
      readRows(SHEET_TABS.expenses),
    ]);
    return {
      batches: batchRows.map(rowToBatch).filter((b): b is Batch => b !== null),
      sales: saleRows.map(rowToSale).filter((s): s is Sale => s !== null),
      expenses: expenseRows.map(rowToExpense).filter((e): e is Expense => e !== null),
      source: 'sheets',
    };
  }
  const db = await readLocal();
  return { ...db, source: 'local' };
}

export async function createBatch(input: Omit<Batch, 'id' | 'createdAt'>): Promise<Batch> {
  const batch: Batch = { ...input, id: newId('bch'), createdAt: new Date().toISOString() };
  if (isSheetsConfigured()) {
    await appendRow(SHEET_TABS.batches, batchToRow(batch));
    await recalculate();
  } else {
    const db = await readLocal();
    await writeLocal({ ...db, batches: [...db.batches, batch] });
  }
  return batch;
}

export async function createSale(input: Omit<Sale, 'id' | 'createdAt'>): Promise<Sale> {
  const sale: Sale = { ...input, id: newId('sal'), createdAt: new Date().toISOString() };
  if (isSheetsConfigured()) {
    await appendRow(SHEET_TABS.sales, saleToRow(sale));
    await recalculate();
  } else {
    const db = await readLocal();
    await writeLocal({ ...db, sales: [...db.sales, sale] });
  }
  return sale;
}

export async function createExpense(input: Omit<Expense, 'id' | 'createdAt'>): Promise<Expense> {
  const expense: Expense = { ...input, id: newId('exp'), createdAt: new Date().toISOString() };
  if (isSheetsConfigured()) {
    await appendRow(SHEET_TABS.expenses, expenseToRow(expense));
  } else {
    const db = await readLocal();
    await writeLocal({ ...db, expenses: [...db.expenses, expense] });
  }
  return expense;
}

export async function updateExpense(id: string, patch: Partial<Expense>): Promise<Expense | null> {
  const data = await readAll();
  const current = data.expenses.find((e) => e.id === id);
  if (!current) return null;
  const clean = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== undefined),
  ) as Partial<Expense>;
  const next: Expense = { ...current, ...clean, id: current.id, createdAt: current.createdAt };
  if (isSheetsConfigured()) {
    const rowNumber = await findRowNumber(SHEET_TABS.expenses, id);
    if (rowNumber) await updateRow(SHEET_TABS.expenses, rowNumber, expenseToRow(next));
  } else {
    const db = await readLocal();
    await writeLocal({ ...db, expenses: db.expenses.map((e) => (e.id === id ? next : e)) });
  }
  return next;
}

export async function removeRecord(
  kind: 'batch' | 'sale' | 'expense',
  id: string,
): Promise<boolean> {
  const tab =
    kind === 'batch' ? SHEET_TABS.batches : kind === 'sale' ? SHEET_TABS.sales : SHEET_TABS.expenses;

  if (isSheetsConfigured()) {
    const rowNumber = await findRowNumber(tab, id);
    if (!rowNumber) return false;
    await deleteRow(tab, rowNumber);
    if (kind !== 'expense') await recalculate();
    return true;
  }

  const db = await readLocal();
  if (kind === 'batch') {
    const next = db.batches.filter((r) => r.id !== id);
    if (next.length === db.batches.length) return false;
    await writeLocal({ ...db, batches: next });
    return true;
  }
  if (kind === 'sale') {
    const next = db.sales.filter((r) => r.id !== id);
    if (next.length === db.sales.length) return false;
    await writeLocal({ ...db, sales: next });
    return true;
  }
  const next = db.expenses.filter((r) => r.id !== id);
  if (next.length === db.expenses.length) return false;
  await writeLocal({ ...db, expenses: next });
  return true;
}

/**
 * Re-kalkulasi FIFO untuk seluruh data lalu tulis balik kolom turunan
 * (HPP per cup, cup terpakai, sisa, status batch, HPP terpakai & laba kotor
 * tiap penjualan) ke Google Sheets. Dipanggil setiap ada mutasi dari dashboard
 * dan oleh webhook Apps Script saat sheet diedit manual.
 */
export async function recalculate(): Promise<{ batches: number; sales: number; warnings: string[] }> {
  const data = await readAll();
  const fifo = runFifo(data.batches, data.sales);

  if (data.source !== 'sheets') {
    return { batches: data.batches.length, sales: data.sales.length, warnings: fifo.warnings };
  }

  const batchById = new Map(fifo.batches.map((b) => [b.id, b]));
  const saleById = new Map(fifo.sales.map((s) => [s.id, s]));

  // Urutan baris di spreadsheet dipertahankan supaya tampilan manual tidak kacau.
  await rewriteRows(
    SHEET_TABS.batches,
    data.batches.map((b) => {
      const state = batchById.get(b.id);
      return batchToRow(b, state && {
        usedCup: state.usedCup,
        remainingCup: state.remainingCup,
        status: state.status,
      });
    }),
  );

  await rewriteRows(
    SHEET_TABS.sales,
    data.sales.map((s) => {
      const state = saleById.get(s.id);
      return saleToRow(s, state && { cogs: state.cogs, grossProfit: state.grossProfit });
    }),
  );

  return { batches: data.batches.length, sales: data.sales.length, warnings: fifo.warnings };
}
