import {
  PO_HEADER,
  buildRow,
  parseDropDate,
  planAddOrder,
  planClearOrder,
  planTotalFormulas,
  planUpdateOrder,
  readPoSheet,
  type PoOrderInput,
  type PoRow,
} from './poImport';

const TEMPLATE_ROWS = 50;

export {
  PO_HEADER,
  buildRow,
  planAddOrder,
  planClearOrder,
  planTotalFormulas,
  planUpdateOrder,
  type PoOrderInput,
};
import { SHEET_TABS, createTab, listTabTitles, readTabValues, writeValues } from './sheets';

/**
 * Tulis-baca tab PO langsung dari dashboard.
 *
 * Formatnya sengaja dipertahankan persis seperti yang sudah dipakai manual di
 * spreadsheet (kolom No, Nama, Jumlah Cup, Harga per Cup, Total Bayar, Status
 * Bayar, Notes), jadi satu pesanan bisa dicatat dari mana saja — lewat web
 * atau langsung di Sheets — dan hasilnya baris yang sama.
 */

export interface PoBoard {
  tab: string;
  date: string | null;
  orders: PoRow[];
  totalCups: number;
  totalBayar: number;
  lunasCups: number;
  belumCups: number;
}

function summarize(tab: string, orders: PoRow[], date: string | null): PoBoard {
  return {
    tab,
    date,
    orders,
    totalCups: orders.reduce((sum, o) => sum + o.cups, 0),
    totalBayar: orders.reduce((sum, o) => sum + o.total, 0),
    lunasCups: orders.filter((o) => o.lunas).reduce((sum, o) => sum + o.cups, 0),
    belumCups: orders.filter((o) => !o.lunas).reduce((sum, o) => sum + o.cups, 0),
  };
}

/** Semua tab PO di spreadsheet, terbaru di atas. */
export async function listPoBoards(): Promise<PoBoard[]> {
  const managed = new Set<string>(Object.values(SHEET_TABS));
  const titles = (await listTabTitles()).filter((t) => !managed.has(t));

  const boards: PoBoard[] = [];
  for (const tab of titles) {
    const values = await readTabValues(tab);
    const sheet = readPoSheet(values);
    if (!sheet) continue;
    const judul = values.slice(0, sheet.headerRow).flat().join(' ');
    boards.push(summarize(tab, sheet.rows, parseDropDate(tab) ?? parseDropDate(judul)));
  }

  return boards.reverse();
}

/** Perbarui baris TOTAL memakai rumus SUM supaya ikut hidup saat diedit manual. */
async function refreshTotalRow(tab: string): Promise<void> {
  for (const update of planTotalFormulas(await readTabValues(tab))) {
    await writeValues(tab, update.a1, [[update.value]], true);
  }
}

/** Tambah pesanan ke slot bernomor pertama yang masih kosong. */
export async function addPoOrder(tab: string, input: PoOrderInput): Promise<number> {
  const values = await readTabValues(tab);
  const plan = planAddOrder(values, input);
  if (!plan) throw new Error(`Tab "${tab}" bukan tab PO.`);

  await writeValues(tab, `A${plan.rowNumber}`, [plan.row]);
  await refreshTotalRow(tab);
  return plan.rowNumber;
}

export async function updatePoOrder(
  tab: string,
  rowNumber: number,
  patch: Partial<PoOrderInput>,
): Promise<void> {
  const plan = planUpdateOrder(await readTabValues(tab), rowNumber, patch);
  if (!plan) throw new Error('Baris pesanan tidak ditemukan.');

  await writeValues(tab, `A${plan.rowNumber}`, [plan.row]);
  await refreshTotalRow(tab);
}

/** Kosongkan baris pesanan tanpa menghapus barisnya, supaya penomoran tetap rapi. */
export async function clearPoOrder(tab: string, rowNumber: number): Promise<void> {
  const plan = planClearOrder(await readTabValues(tab), rowNumber);
  if (!plan) throw new Error(`Tab "${tab}" bukan tab PO.`);

  await writeValues(tab, `A${plan.rowNumber}`, [plan.row]);
  await refreshTotalRow(tab);
}

/** Bikin tab batch PO baru memakai template yang sama dengan yang sudah ada. */
export async function createPoBoard(namaBatch: string): Promise<string> {
  const tab = namaBatch.trim().slice(0, 60) || 'PO Batch Baru';
  const titles = await listTabTitles();
  if (titles.includes(tab)) throw new Error(`Tab "${tab}" sudah ada di spreadsheet.`);

  await createTab(tab);

  const rows: (string | number)[][] = [
    [`Re-Bites - List PO ${tab}`],
    [''],
    PO_HEADER,
    ...Array.from({ length: TEMPLATE_ROWS }, (_, i) => [i + 1, '', '', '', '', '', '']),
    [''],
    ['', 'TOTAL', `=SUM(C4:C${3 + TEMPLATE_ROWS})`, '', `=SUM(E4:E${3 + TEMPLATE_ROWS})`, ''],
  ];

  await writeValues(tab, 'A1', rows, true);
  return tab;
}
