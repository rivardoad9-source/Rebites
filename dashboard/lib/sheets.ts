import { google } from 'googleapis';
import type { sheets_v4 } from 'googleapis';

/**
 * Wrapper tipis di atas Google Sheets API v4.
 *
 * Kredensial diambil dari environment variable:
 *   GOOGLE_SHEET_ID      -> id spreadsheet (potongan URL setelah /d/)
 *   GOOGLE_CLIENT_EMAIL  -> email service account
 *   GOOGLE_PRIVATE_KEY   -> private key service account (baris baru boleh ditulis \n)
 */

export const SHEET_TABS = {
  batches: 'Batches',
  sales: 'Sales',
  expenses: 'Expenses',
} as const;

export type TabName = (typeof SHEET_TABS)[keyof typeof SHEET_TABS];

export const HEADERS: Record<TabName, string[]> = {
  Batches: [
    'ID',
    'Tanggal',
    'Nama Item',
    'Total Biaya',
    'Yield Cup',
    'HPP per Cup',
    'Terpakai (Cup)',
    'Sisa (Cup)',
    'Status',
    'Catatan',
    'Dibuat',
  ],
  Sales: [
    'ID',
    'Tanggal',
    'Cup Terjual',
    'Harga per Cup',
    'Omzet',
    'HPP Terpakai',
    'Laba Kotor',
    'Channel',
    'Catatan',
    'Dibuat',
  ],
  Expenses: ['ID', 'Tanggal', 'Kategori', 'Nominal', 'Catatan', 'Dibuat'],
};

export function isSheetsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SHEET_ID &&
      process.env.GOOGLE_CLIENT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY,
  );
}

function privateKey(): string {
  // Di dashboard hosting (Vercel/Railway) private key biasanya ditempel satu
  // baris dengan literal \n, jadi perlu dikembalikan jadi baris baru asli.
  return (process.env.GOOGLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n').trim();
}

let cachedClient: sheets_v4.Sheets | null = null;

export function getSheetsClient(): sheets_v4.Sheets {
  if (!cachedClient) {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: privateKey(),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    cachedClient = google.sheets({ version: 'v4', auth });
  }
  return cachedClient;
}

function spreadsheetId(): string {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error('GOOGLE_SHEET_ID belum diisi.');
  return id;
}

const sheetIdCache = new Map<TabName, number>();
let tabsReady = false;

/** Bikin tab yang belum ada + tulis baris header kalau masih kosong. */
export async function ensureTabs(): Promise<void> {
  if (tabsReady) return;
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: spreadsheetId() });
  const existing = new Map<string, number>();
  for (const s of meta.data.sheets ?? []) {
    const title = s.properties?.title;
    const id = s.properties?.sheetId;
    if (title && typeof id === 'number') existing.set(title, id);
  }

  const missing = (Object.values(SHEET_TABS) as TabName[]).filter((t) => !existing.has(t));
  if (missing.length > 0) {
    const res = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId(),
      requestBody: {
        requests: missing.map((title) => ({ addSheet: { properties: { title } } })),
      },
    });
    for (const reply of res.data.replies ?? []) {
      const props = reply.addSheet?.properties;
      if (props?.title && typeof props.sheetId === 'number') {
        existing.set(props.title, props.sheetId);
      }
    }
  }

  for (const tab of Object.values(SHEET_TABS) as TabName[]) {
    const id = existing.get(tab);
    if (typeof id === 'number') sheetIdCache.set(tab, id);
    const head = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId(),
      range: `${tab}!A1:Z1`,
    });
    const current = head.data.values?.[0] ?? [];
    if (current.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheetId(),
        range: `${tab}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [HEADERS[tab]] },
      });
    }
  }

  tabsReady = true;
}

async function sheetIdOf(tab: TabName): Promise<number> {
  await ensureTabs();
  const id = sheetIdCache.get(tab);
  if (typeof id !== 'number') throw new Error(`Tab "${tab}" tidak ditemukan di spreadsheet.`);
  return id;
}

/** Semua baris data (tanpa header). */
export async function readRows(tab: TabName): Promise<string[][]> {
  await ensureTabs();
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: `${tab}!A2:Z`,
  });
  return (res.data.values ?? []).map((row) => row.map((cell) => (cell ?? '').toString()));
}

export async function appendRow(tab: TabName, values: (string | number)[]): Promise<void> {
  await ensureTabs();
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: spreadsheetId(),
    range: `${tab}!A1`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [values] },
  });
}

/** Nomor baris spreadsheet (1-based, header di baris 1) untuk sebuah ID. */
export async function findRowNumber(tab: TabName, id: string): Promise<number | null> {
  const rows = await readRows(tab);
  const index = rows.findIndex((row) => row[0] === id);
  return index === -1 ? null : index + 2;
}

export async function updateRow(
  tab: TabName,
  rowNumber: number,
  values: (string | number)[],
): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: spreadsheetId(),
    range: `${tab}!A${rowNumber}`,
    valueInputOption: 'RAW',
    requestBody: { values: [values] },
  });
}

export async function deleteRow(tab: TabName, rowNumber: number): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: spreadsheetId(),
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: await sheetIdOf(tab),
              dimension: 'ROWS',
              startIndex: rowNumber - 1,
              endIndex: rowNumber,
            },
          },
        },
      ],
    },
  });
}

/**
 * Tulis ulang seluruh blok data sebuah tab (dipakai saat re-kalkulasi FIFO
 * mengembalikan kolom turunan seperti HPP terpakai / status batch ke Sheets).
 */
export async function rewriteRows(tab: TabName, rows: (string | number)[][]): Promise<void> {
  await ensureTabs();
  const sheets = getSheetsClient();
  const existing = await readRows(tab);
  const width = HEADERS[tab].length;

  if (rows.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId(),
      range: `${tab}!A2`,
      valueInputOption: 'RAW',
      requestBody: { values: rows.map((r) => padRow(r, width)) },
    });
  }

  // Bersihkan sisa baris lama kalau jumlah baris menyusut.
  if (existing.length > rows.length) {
    await sheets.spreadsheets.values.clear({
      spreadsheetId: spreadsheetId(),
      range: `${tab}!A${rows.length + 2}:Z${existing.length + 1}`,
    });
  }
}

function padRow(row: (string | number)[], width: number): (string | number)[] {
  const out = [...row];
  while (out.length < width) out.push('');
  return out.slice(0, width);
}
