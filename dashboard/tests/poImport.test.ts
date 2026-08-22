import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isPoTab, parseDropDate, parseOrders, parsePoTab, readPoSheet } from '../lib/poImport.ts';

/** Cuplikan asli dari spreadsheet "Rebites PO" (BATCH 1). */
const BATCH_1: string[][] = [
  ['Re-Bites - List PO BATCH 1 16-19 Agustus drop', '', '', '', '', ''],
  ['', '', '', '', '', ''],
  ['No', 'Nama', 'Jumlah Cup', 'Harga per Cup', 'Total Bayar', 'Status Bayar', 'Notes'],
  ['1', 'Steve Salim', '10', '15.000', '150.000', 'Lunas', ''],
  ['2', 'Zia', '1', '14.000', '14.000', 'Lunas', ''],
  ['3', 'Nata', '1', '14.000', '14.000', 'Lunas', ''],
  ['4', 'Cio', '2', '15.000', '30.000', 'Lunas', 'Mangganya jangan campur yang asem'],
  ['5', 'Ken Gunawan', '1', '15.000', '15.000', 'Lunas', 'Mangganya rada lembek'],
  ['6', 'Elza', '5', '14.000', '70.000', 'Lunas', ''],
  ['7', 'Ferry', '1', '15.000', '15.000', 'Lunas', ''],
  ['8', 'Lord', '1', '15.000', '15.000', 'Lunas', ''],
  ['9', '', '', '', '', '', ''],
  ['10', '', '', '', '', '', ''],
  ['', '', '', '', '', '', ''],
  ['', 'TOTAL', '22', '', '323.000', '', ''],
];

const BATCH_2: string[][] = [
  ['Re-Bites - List PO BATCH 2 24-26 Agustus drop', '', '', '', '', ''],
  ['', '', '', '', '', ''],
  ['No', 'Nama', 'Jumlah Cup', 'Harga per Cup', 'Total Bayar', 'Status Bayar'],
  ['1', 'Aline', '1', '15.000', '15.000', 'Belum'],
  ['2', '', '', '', '', ''],
  ['', 'TOTAL', '1', '', '15.000', ''],
];

const TODAY = new Date(2026, 7, 22); // 22 Agustus 2026

test('tab PO dikenali, tab lain tidak', () => {
  assert.equal(isPoTab(BATCH_1), true);
  assert.equal(isPoTab([['ID', 'Tanggal', 'Cup Terjual', 'Harga per Cup']]), false);
  assert.equal(isPoTab([['catatan bebas'], ['halo']]), false);
});

test('pesanan terbaca, baris kosong & baris TOTAL diabaikan', () => {
  const orders = parseOrders(BATCH_1);
  assert.equal(orders.length, 8);
  assert.equal(orders.reduce((sum, o) => sum + o.cups, 0), 22);
  assert.equal(
    orders.reduce((sum, o) => sum + o.cups * o.pricePerCup, 0),
    323_000, // sama persis dengan baris TOTAL di sheet
  );
  assert.equal(orders[0].nama, 'Steve Salim');
  assert.equal(orders.every((o) => o.lunas), true);
});

test('pesanan dikelompokkan per harga jual', () => {
  const groups = parsePoTab('BATCH 1', BATCH_1, { today: TODAY });
  assert.deepEqual(
    groups.map((g) => [g.cups, g.pricePerCup, g.orders]),
    [
      [7, 14_000, 3],
      [15, 15_000, 5],
    ],
  );
  assert.equal(groups.reduce((sum, g) => sum + g.cups * g.pricePerCup, 0), 323_000);
});

test('tanggal drop diambil dari tanggal terakhir di judul', () => {
  assert.equal(parseDropDate('List PO BATCH 1 16-19 Agustus drop', TODAY), '2026-08-19');
  assert.equal(parseDropDate('BATCH 2 24-26 Agustus', TODAY), '2026-08-26');
  assert.equal(parseDropDate('PO 3 September drop', TODAY), '2026-09-03');
  assert.equal(parseDropDate('tanpa tanggal', TODAY), null);
  // Bulan yang jauh di depan dianggap tahun lalu, bukan tahun ini.
  assert.equal(parseDropDate('PO 5 Desember drop', new Date(2026, 0, 10)), '2025-12-05');
});

test('judul di baris pertama dipakai kalau nama tab tidak memuat tanggal', () => {
  const groups = parsePoTab('Sheet3', BATCH_1, { today: TODAY });
  assert.equal(groups[0].date, '2026-08-19');
});

test('pesanan belum lunas dilewati kecuali diminta', () => {
  assert.deepEqual(parsePoTab('BATCH 2', BATCH_2, { today: TODAY }), []);

  const withUnpaid = parsePoTab('BATCH 2', BATCH_2, { includeUnpaid: true, today: TODAY });
  assert.equal(withUnpaid.length, 1);
  assert.equal(withUnpaid[0].cups, 1);
  assert.equal(withUnpaid[0].date, '2026-08-26');
});

test('ID kelompok stabil supaya impor ulang tidak menggandakan baris', () => {
  const first = parsePoTab('BATCH 1', BATCH_1, { today: TODAY });
  const second = parsePoTab('BATCH 1', BATCH_1, { today: new Date(2026, 8, 1) });
  assert.deepEqual(first.map((g) => g.id), second.map((g) => g.id));
  assert.deepEqual(first.map((g) => g.id), ['po_batch-1_14000', 'po_batch-1_15000']);
});

test('penambahan pesanan baru menambah cup pada ID yang sama', () => {
  const rows = [...BATCH_1];
  rows.splice(rows.length - 2, 0, ['9', 'Dewi', '3', '15.000', '45.000', 'Lunas', '']);
  const groups = parsePoTab('BATCH 1', rows, { today: TODAY });
  const lima_belas = groups.find((g) => g.pricePerCup === 15_000)!;
  assert.equal(lima_belas.id, 'po_batch-1_15000');
  assert.equal(lima_belas.cups, 18);
  assert.equal(lima_belas.orders, 6);
});

test('readPoSheet memetakan nomor baris, slot kosong, dan baris TOTAL', () => {
  const sheet = readPoSheet(BATCH_1)!;
  assert.equal(sheet.headerRow, 3);
  assert.equal(sheet.rows.length, 8);
  assert.equal(sheet.rows[0].rowNumber, 4); // Steve Salim ada di baris 4
  assert.equal(sheet.rows[0].nama, 'Steve Salim');
  assert.equal(sheet.rows[0].total, 150_000);
  assert.equal(sheet.rows[7].rowNumber, 11); // Lord
  assert.equal(sheet.nextEmptyRow, 12); // baris bernomor 9 yang masih kosong
  assert.equal(sheet.totalRow, 15);
  assert.equal(sheet.lastDataRow, 13);
});

test('readPoSheet menolak tab yang bukan PO', () => {
  assert.equal(readPoSheet([['ID', 'Tanggal', 'Kategori', 'Nominal']]), null);
});
