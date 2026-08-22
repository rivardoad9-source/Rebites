import { parsePoTab, type PoGroup } from './poImport';
import {
  SHEET_TABS,
  appendRow,
  deleteRow,
  isSheetsConfigured,
  listTabTitles,
  readRows,
  readTabValues,
  updateRow,
} from './sheets';
import { saleToRow } from './store';
import type { Sale } from './types';

/**
 * Sinkronisasi tab "List PO" -> tab Sales.
 *
 * Sifatnya rekonsiliasi, bukan sekadar tambah: baris penjualan hasil impor
 * diberi ID berawalan `po_` yang deterministik, jadi menjalankan ini berkali-kali
 * tidak menggandakan data. Pesanan yang bertambah akan memperbarui baris yang
 * sama, dan kelompok yang hilang dari tab PO ikut dihapus dari Sales.
 *
 * Baris penjualan yang kamu input manual lewat dashboard (ID `sal_...`) tidak
 * pernah disentuh.
 */

const PO_PREFIX = 'po_';

export interface PoImportResult {
  enabled: boolean;
  tabs: string[];
  created: number;
  updated: number;
  deleted: number;
  cups: number;
  omzet: number;
}

const empty: PoImportResult = {
  enabled: false,
  tabs: [],
  created: 0,
  updated: 0,
  deleted: 0,
  cups: 0,
  omzet: 0,
};

function includeUnpaid(): boolean {
  return (process.env.PO_IMPORT_INCLUDE_UNPAID ?? '').toLowerCase() === 'true';
}

function groupToSale(group: PoGroup, createdAt: string): Sale {
  return {
    id: group.id,
    date: group.date,
    cups: group.cups,
    pricePerCup: group.pricePerCup,
    channel: 'Pre-order',
    note: group.note,
    createdAt,
  };
}

export async function importPoTabs(): Promise<PoImportResult> {
  if (!isSheetsConfigured()) return empty;
  if ((process.env.PO_IMPORT ?? '').toLowerCase() === 'off') return empty;

  const managed = new Set<string>(Object.values(SHEET_TABS));
  const titles = (await listTabTitles()).filter((title) => !managed.has(title));

  const desired = new Map<string, PoGroup>();
  const tabs: string[] = [];

  for (const title of titles) {
    const rows = await readTabValues(title);
    const groups = parsePoTab(title, rows, { includeUnpaid: includeUnpaid() });
    if (groups.length === 0) continue;
    tabs.push(title);
    for (const group of groups) desired.set(group.id, group);
  }

  // Baris Sales hasil impor sebelumnya, lengkap dengan nomor barisnya.
  const salesRows = await readRows(SHEET_TABS.sales);
  const existing = new Map<string, { rowNumber: number; row: string[] }>();
  salesRows.forEach((row, index) => {
    const id = (row[0] ?? '').trim();
    if (id.startsWith(PO_PREFIX)) existing.set(id, { rowNumber: index + 2, row });
  });

  let created = 0;
  let updated = 0;
  const now = new Date().toISOString();

  for (const [id, group] of desired) {
    const current = existing.get(id);
    if (!current) {
      await appendRow(SHEET_TABS.sales, saleToRow(groupToSale(group, now)));
      created += 1;
      continue;
    }

    // Hanya tulis kalau memang ada yang berubah, supaya kuota API tidak terbuang.
    const sama =
      (current.row[1] ?? '') === group.date &&
      Number(current.row[2] ?? 0) === group.cups &&
      Number(current.row[3] ?? 0) === group.pricePerCup;
    if (sama) continue;

    const createdAt = (current.row[9] ?? '').trim() || now;
    await updateRow(SHEET_TABS.sales, current.rowNumber, saleToRow(groupToSale(group, createdAt)));
    updated += 1;
  }

  // Kelompok yang hilang dari tab PO (mis. batch dibatalkan) ikut dibersihkan.
  const stale = [...existing.entries()]
    .filter(([id]) => !desired.has(id))
    .sort((a, b) => b[1].rowNumber - a[1].rowNumber); // hapus dari bawah supaya nomor baris tidak bergeser

  for (const [, { rowNumber }] of stale) {
    await deleteRow(SHEET_TABS.sales, rowNumber);
  }

  const groups = [...desired.values()];
  return {
    enabled: true,
    tabs,
    created,
    updated,
    deleted: stale.length,
    cups: groups.reduce((sum, g) => sum + g.cups, 0),
    omzet: groups.reduce((sum, g) => sum + g.cups * g.pricePerCup, 0),
  };
}
