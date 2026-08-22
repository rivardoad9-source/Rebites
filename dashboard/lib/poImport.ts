/**
 * Pembaca tab "List PO" di spreadsheet Re-Bites.
 *
 * Tab PO ditulis untuk manusia (satu baris per pemesan, ada baris judul yang
 * di-merge, penomoran 1..50 yang mayoritas kosong, dan baris TOTAL di bawah),
 * sementara dashboard butuh baris penjualan yang bisa dihitung. Modul ini
 * menjembatani keduanya: pesanan dikelompokkan per harga jual lalu diringkas
 * jadi satu baris penjualan per kelompok.
 *
 * Murni, tanpa I/O, supaya gampang diuji dengan contoh sheet asli.
 */

export interface PoOrder {
  nama: string;
  cups: number;
  pricePerCup: number;
  status: string;
  lunas: boolean;
}

export interface PoGroup {
  /** ID deterministik supaya impor ulang memperbarui baris yang sama, bukan menambah. */
  id: string;
  tab: string;
  date: string;
  cups: number;
  pricePerCup: number;
  orders: number;
  note: string;
}

const BULAN = [
  'januari', 'februari', 'maret', 'april', 'mei', 'juni',
  'juli', 'agustus', 'september', 'oktober', 'november', 'desember',
];

function norm(value: unknown): string {
  return (value ?? '').toString().trim().toLowerCase();
}

function toNumber(value: unknown): number {
  const raw = (value ?? '').toString().replace(/[^\d,.-]/g, '');
  if (!raw) return 0;
  // Sama seperti parser rupiah: grup 3 digit terakhir = pemisah ribuan.
  const tail = raw.match(/[.,](\d+)$/);
  const cleaned =
    tail && tail[1].length !== 3
      ? `${raw.slice(0, raw.length - tail[1].length - 1).replace(/[.,]/g, '')}.${tail[1]}`
      : raw.replace(/[.,]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export interface PoRow extends PoOrder {
  /** Nomor baris di spreadsheet (1-based), dipakai untuk edit & hapus. */
  rowNumber: number;
  nomor: string;
  total: number;
  notes: string;
}

export interface PoSheet {
  headerRow: number;
  columns: Record<string, number>;
  rows: PoRow[];
  /** Baris kosong pertama yang siap diisi pesanan baru (1-based). */
  nextEmptyRow: number | null;
  totalRow: number | null;
  /** Baris data terakhir (termasuk yang masih kosong), untuk rentang SUM. */
  lastDataRow: number;
}

export function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/** Cari baris header — yang memuat kolom "Jumlah Cup" dan "Harga per Cup". */
export function findHeaderRow(rows: string[][]): number {
  return rows.findIndex((row) => {
    const cells = row.map(norm);
    return (
      cells.some((c) => c.includes('jumlah cup') || c === 'cup') &&
      cells.some((c) => c.includes('harga'))
    );
  });
}

export function isPoTab(rows: string[][]): boolean {
  const header = findHeaderRow(rows);
  if (header === -1) return false;
  const cells = rows[header].map(norm);
  return cells.some((c) => c.includes('nama'));
}

/**
 * Petakan judul kolom -> indeks. Sekali sebuah kolom terpakai, dia tidak bisa
 * dipilih lagi, dan "Harga per Cup" sengaja diklaim lebih dulu — kalau tidak,
 * kata "cup" di dalamnya bikin dia ikut terbaca sebagai kolom Jumlah Cup dan
 * angka bisa tertulis ke kolom yang salah di spreadsheet.
 */
function columnIndexes(header: string[]): Record<string, number> {
  const used = new Set<number>();
  const pick = (matcher: (cell: string) => boolean): number => {
    const index = header.findIndex((cell, i) => !used.has(i) && matcher(norm(cell)));
    if (index >= 0) used.add(index);
    return index;
  };

  const nama = pick((c) => c.includes('nama'));
  const price = pick((c) => c.includes('harga'));
  const cups = pick((c) => c.includes('jumlah') || c.includes('cup'));
  const total = pick((c) => c.includes('total'));
  const status = pick((c) => c.includes('status') || c.includes('bayar'));
  const notes = pick((c) => c.includes('note') || c.includes('catatan') || c.includes('keterangan'));

  return { nama, cups, price, total, status, notes };
}

/**
 * Tanggal drop diambil dari judul tab / baris judul, mis.
 * "List PO BATCH 1 16-19 Agustus drop" -> tanggal terakhir (19 Agustus).
 */
export function parseDropDate(text: string, today = new Date()): string | null {
  const lower = text.toLowerCase();
  const bulanIndex = BULAN.findIndex((b) => lower.includes(b));
  if (bulanIndex === -1) return null;

  const before = lower.slice(0, lower.indexOf(BULAN[bulanIndex]));
  const angka = before.match(/(\d{1,2})(?:\s*[-–—]\s*(\d{1,2}))?\s*$/);
  if (!angka) return null;

  const day = Number(angka[2] ?? angka[1]);
  if (!day || day > 31) return null;

  let year = today.getFullYear();
  const candidate = new Date(year, bulanIndex, day);
  // Tab lama yang bulannya sudah lewat jauh di depan -> ambil tahun sebelumnya.
  if (candidate.getTime() - today.getTime() > 1000 * 60 * 60 * 24 * 180) year -= 1;

  return `${year}-${`${bulanIndex + 1}`.padStart(2, '0')}-${`${day}`.padStart(2, '0')}`;
}

/**
 * Baca tab PO lengkap dengan nomor barisnya — dipakai saat dashboard perlu
 * menambah, mengubah, atau mengosongkan satu baris pesanan di spreadsheet.
 */
export function readPoSheet(rows: string[][]): PoSheet | null {
  const headerRow = findHeaderRow(rows);
  if (headerRow === -1 || !isPoTab(rows)) return null;

  const columns = columnIndexes(rows[headerRow]);
  const parsed: PoRow[] = [];
  let totalRow: number | null = null;
  let nextEmptyRow: number | null = null;
  let lastDataRow = headerRow + 1;

  for (let i = headerRow + 1; i < Math.max(rows.length, headerRow + 2); i += 1) {
    const cells = (rows[i] ?? []).map((c) => (c ?? '').toString());
    if (cells.some((c) => norm(c) === 'total')) {
      totalRow = i + 1;
      break;
    }

    const nomor = columns.nama === -1 ? '' : (cells[0] ?? '').trim();
    const nama = (columns.nama === -1 ? '' : (cells[columns.nama] ?? '')).trim();
    const cups = columns.cups === -1 ? 0 : toNumber(cells[columns.cups]);
    const price = columns.price === -1 ? 0 : toNumber(cells[columns.price]);

    // Baris bernomor tapi masih kosong = slot siap pakai untuk pesanan baru.
    const kosong = !nama && cups <= 0;
    if (kosong && nomor) {
      lastDataRow = i + 1;
      if (nextEmptyRow === null) nextEmptyRow = i + 1;
      continue;
    }
    if (kosong) continue;

    lastDataRow = i + 1;
    const status = columns.status === -1 ? '' : (cells[columns.status] ?? '').trim();
    parsed.push({
      rowNumber: i + 1,
      nomor,
      nama,
      cups,
      pricePerCup: price,
      total: columns.total === -1 ? cups * price : toNumber(cells[columns.total]) || cups * price,
      status,
      lunas: norm(status).startsWith('lunas'),
      notes: (columns.notes === -1 ? '' : (cells[columns.notes] ?? '')).trim(),
    });
  }

  return { headerRow: headerRow + 1, columns, rows: parsed, nextEmptyRow, totalRow, lastDataRow };
}

export function parseOrders(rows: string[][]): PoOrder[] {
  const headerRow = findHeaderRow(rows);
  if (headerRow === -1) return [];

  const col = columnIndexes(rows[headerRow]);
  const orders: PoOrder[] = [];

  for (const row of rows.slice(headerRow + 1)) {
    const cells = row.map((c) => (c ?? '').toString());
    // Baris rekap ("TOTAL") menutup daftar pesanan.
    if (cells.some((c) => norm(c) === 'total')) break;

    const cups = col.cups === -1 ? 0 : toNumber(cells[col.cups]);
    const price = col.price === -1 ? 0 : toNumber(cells[col.price]);
    if (cups <= 0 || price <= 0) continue;

    const status = col.status === -1 ? '' : (cells[col.status] ?? '').trim();
    orders.push({
      nama: (col.nama === -1 ? '' : (cells[col.nama] ?? '')).trim(),
      cups,
      pricePerCup: price,
      status,
      lunas: norm(status).startsWith('lunas'),
    });
  }

  return orders;
}

/**
 * Ringkas satu tab PO jadi baris penjualan — satu baris per harga jual,
 * karena satu batch bisa punya beberapa harga (mis. 14.000 dan 15.000).
 */
export function parsePoTab(
  tab: string,
  rows: string[][],
  options: { includeUnpaid?: boolean; today?: Date } = {},
): PoGroup[] {
  if (!isPoTab(rows)) return [];

  const today = options.today ?? new Date();
  const judul = rows
    .slice(0, findHeaderRow(rows))
    .flat()
    .map((c) => (c ?? '').toString())
    .join(' ');
  const date =
    parseDropDate(tab, today) ??
    parseDropDate(judul, today) ??
    `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, '0')}-${`${today.getDate()}`.padStart(2, '0')}`;

  const orders = parseOrders(rows).filter((o) => options.includeUnpaid || o.lunas);

  const byPrice = new Map<number, { cups: number; orders: number }>();
  for (const order of orders) {
    const current = byPrice.get(order.pricePerCup) ?? { cups: 0, orders: 0 };
    byPrice.set(order.pricePerCup, {
      cups: current.cups + order.cups,
      orders: current.orders + 1,
    });
  }

  return [...byPrice.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([pricePerCup, agg]) => ({
      id: `po_${slug(tab)}_${pricePerCup}`,
      tab,
      date,
      cups: agg.cups,
      pricePerCup,
      orders: agg.orders,
      note: `Impor otomatis dari tab "${tab}" · ${agg.orders} pesanan @ ${pricePerCup.toLocaleString('id-ID')}`,
    }));
}

/* ------------------------------------------------ menulis balik ke tab PO */

export const PO_HEADER = [
  'No',
  'Nama',
  'Jumlah Cup',
  'Harga per Cup',
  'Total Bayar',
  'Status Bayar',
  'Notes',
];

const TEMPLATE_ROWS = 50;

export interface PoOrderInput {
  nama: string;
  cups: number;
  pricePerCup: number;
  lunas: boolean;
  notes?: string;
}

function colLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

/**
 * Lebar tulisan mengikuti lebar header tab itu sendiri — jangan dipaksa
 * selebar template bawaan, supaya kolom di luar tabel tidak ikut terhapus.
 */
function rowWidth(values: string[][], sheet: PoSheet): number {
  const header = values[sheet.headerRow - 1]?.length ?? 0;
  const lastUsed = Math.max(...Object.values(sheet.columns).map((index) => index + 1), 1);
  return Math.max(header, lastUsed);
}

export function buildRow(
  existing: string[],
  columns: Record<string, number>,
  width: number,
  input: PoOrderInput,
): (string | number)[] {
  const row: (string | number)[] = Array.from({ length: width }, (_, i) => existing[i] ?? '');
  const set = (index: number, value: string | number) => {
    if (index >= 0 && index < width) row[index] = value;
  };

  set(columns.nama, input.nama);
  set(columns.cups, Math.round(input.cups));
  set(columns.price, Math.round(input.pricePerCup));
  set(columns.total, Math.round(input.cups) * Math.round(input.pricePerCup));
  set(columns.status, input.lunas ? 'Lunas' : 'Belum');
  if (input.notes !== undefined) set(columns.notes, input.notes);

  return row;
}

/**
 * Rencana penulisan satu pesanan baru: baris mana yang dipakai dan isinya apa.
 * Murni supaya bisa diuji tanpa menyentuh spreadsheet sungguhan.
 */
export function planAddOrder(
  values: string[][],
  input: PoOrderInput,
): { rowNumber: number; row: (string | number)[] } | null {
  const sheet = readPoSheet(values);
  if (!sheet) return null;

  const width = rowWidth(values, sheet);
  // Utamakan slot bernomor yang masih kosong; kalau template penuh, sisipkan
  // tepat sebelum baris TOTAL supaya rekapnya tidak ikut terdorong.
  const rowNumber = sheet.nextEmptyRow ?? (sheet.totalRow ?? sheet.lastDataRow + 1);
  const row = buildRow(values[rowNumber - 1] ?? [], sheet.columns, width, input);
  if (!row[0]) row[0] = sheet.rows.length + 1;

  return { rowNumber, row };
}

/** Rencana perubahan satu baris pesanan yang sudah ada. */
export function planUpdateOrder(
  values: string[][],
  rowNumber: number,
  patch: Partial<PoOrderInput>,
): { rowNumber: number; row: (string | number)[] } | null {
  const sheet = readPoSheet(values);
  if (!sheet) return null;

  const current = sheet.rows.find((r) => r.rowNumber === rowNumber);
  if (!current) return null;

  const width = rowWidth(values, sheet);
  return {
    rowNumber,
    row: buildRow(values[rowNumber - 1] ?? [], sheet.columns, width, {
      nama: patch.nama ?? current.nama,
      cups: patch.cups ?? current.cups,
      pricePerCup: patch.pricePerCup ?? current.pricePerCup,
      lunas: patch.lunas ?? current.lunas,
      notes: patch.notes ?? current.notes,
    }),
  };
}

/** Rencana pengosongan baris — nomor urut sengaja dipertahankan. */
export function planClearOrder(
  values: string[][],
  rowNumber: number,
): { rowNumber: number; row: (string | number)[] } | null {
  const sheet = readPoSheet(values);
  if (!sheet) return null;

  const width = rowWidth(values, sheet);
  const row: (string | number)[] = Array.from({ length: width }, () => '');
  row[0] = (values[rowNumber - 1] ?? [])[0] ?? '';
  return { rowNumber, row };
}

/** Rumus SUM untuk baris TOTAL, mengikuti posisi kolom di tab tersebut. */
export function planTotalFormulas(values: string[][]): { a1: string; value: string }[] {
  const sheet = readPoSheet(values);
  if (!sheet || !sheet.totalRow) return [];

  const first = sheet.headerRow + 1;
  const last = Math.max(sheet.lastDataRow, first);

  return [sheet.columns.cups, sheet.columns.total]
    .filter((index) => index >= 0)
    .map((index) => {
      const c = colLetter(index);
      return { a1: `${c}${sheet.totalRow}`, value: `=SUM(${c}${first}:${c}${last})` };
    });
}

