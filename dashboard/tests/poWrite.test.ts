import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildRow,
  planAddOrder,
  planClearOrder,
  planTotalFormulas,
  planUpdateOrder,
} from '../lib/poImport.ts';

/** Struktur sama persis dengan tab "List PO BATCH 1" di spreadsheet Re-Bites. */
function batch(): string[][] {
  return [
    ['Re-Bites - List PO BATCH 1 16-19 Agustus drop', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['No', 'Nama', 'Jumlah Cup', 'Harga per Cup', 'Total Bayar', 'Status Bayar', 'Notes'],
    ['1', 'Steve Salim', '10', '15.000', '150.000', 'Lunas', ''],
    ['2', 'Zia', '1', '14.000', '14.000', 'Lunas', ''],
    ['3', '', '', '', '', '', ''],
    ['4', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['', 'TOTAL', '11', '', '164.000', '', ''],
  ];
}

const pesanan = {
  nama: 'Dewi',
  cups: 3,
  pricePerCup: 15_000,
  lunas: true,
  notes: 'ambil di kampus',
};

test('pesanan baru masuk ke slot bernomor kosong pertama, bukan ditumpuk di bawah', () => {
  const plan = planAddOrder(batch(), pesanan)!;
  assert.equal(plan.rowNumber, 6); // baris bernomor "3"
  assert.deepEqual(plan.row, ['3', 'Dewi', 3, 15_000, 45_000, 'Lunas', 'ambil di kampus']);
});

test('Total Bayar dihitung ulang, bukan diambil dari input', () => {
  const plan = planAddOrder(batch(), { ...pesanan, cups: 7, pricePerCup: 14_000 })!;
  assert.equal(plan.row[4], 98_000);
});

test('kalau slot template habis, pesanan disisipkan tepat di baris TOTAL', () => {
  const penuh = batch().filter((row) => !(row[0] && !row[1])); // buang slot kosong
  const plan = planAddOrder(penuh, pesanan)!;
  const totalRow = penuh.findIndex((row) => row[1] === 'TOTAL') + 1;
  assert.equal(plan.rowNumber, totalRow);
  assert.equal(plan.row[0], 3); // dinomori sendiri melanjutkan urutan
});

test('ubah status bayar tidak mengubah kolom lain', () => {
  const plan = planUpdateOrder(batch(), 4, { lunas: false })!;
  assert.deepEqual(plan.row, ['1', 'Steve Salim', 10, 15_000, 150_000, 'Belum', '']);
});

test('ubah jumlah cup ikut memperbarui Total Bayar', () => {
  const plan = planUpdateOrder(batch(), 5, { cups: 4 })!;
  assert.deepEqual(plan.row, ['2', 'Zia', 4, 14_000, 56_000, 'Lunas', '']);
});

test('baris yang bukan pesanan ditolak', () => {
  assert.equal(planUpdateOrder(batch(), 7, { lunas: true }), null); // slot kosong
  assert.equal(planAddOrder([['catatan bebas']], pesanan), null);
});

test('hapus pesanan mengosongkan isi tapi menyisakan nomor urut', () => {
  const plan = planClearOrder(batch(), 4)!;
  assert.deepEqual(plan.row, ['1', '', '', '', '', '', '']);
});

test('baris TOTAL diisi rumus SUM sesuai posisi kolomnya', () => {
  assert.deepEqual(planTotalFormulas(batch()), [
    { a1: 'C9', value: '=SUM(C4:C7)' },
    { a1: 'E9', value: '=SUM(E4:E7)' },
  ]);
  assert.deepEqual(planTotalFormulas([['bukan tab PO']]), []);
});

test('tata letak kolom yang berbeda tetap ditulis di kolom yang benar', () => {
  // Kolom Notes hilang dan urutannya digeser.
  const lain: string[][] = [
    ['No', 'Nama', 'Harga per Cup', 'Jumlah Cup', 'Total Bayar', 'Status Bayar'],
    ['1', '', '', '', '', ''],
    ['', 'TOTAL', '', '', '', ''],
  ];
  const plan = planAddOrder(lain, pesanan)!;
  assert.equal(plan.rowNumber, 2);
  assert.deepEqual(plan.row, ['1', 'Dewi', 15_000, 3, 45_000, 'Lunas']);
});

test('buildRow tidak menulis melewati lebar tabel', () => {
  const row = buildRow([], { nama: 1, cups: 2, price: 3, total: 4, status: 5 }, 4, pesanan);
  assert.equal(row.length, 4);
  assert.deepEqual(row, ['', 'Dewi', 3, 15_000]);
});
