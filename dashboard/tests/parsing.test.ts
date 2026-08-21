import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeCategory, normalizeDate, parseRupiah } from '../lib/parse.ts';

test('parseRupiah menerima format tulisan tangan dari Google Sheets', () => {
  assert.equal(parseRupiah('Rp 1.250.000'), 1_250_000);
  assert.equal(parseRupiah('1250000'), 1_250_000);
  assert.equal(parseRupiah('Rp15.000'), 15_000);
  assert.equal(parseRupiah('15,5'), 16); // dibulatkan ke rupiah utuh
  assert.equal(parseRupiah(' 250 '), 250);
  assert.equal(parseRupiah(''), 0);
  assert.equal(parseRupiah('bukan angka'), 0);
  assert.equal(parseRupiah(12345.6), 12_346);
});

test('normalizeDate menyeragamkan format tanggal', () => {
  assert.equal(normalizeDate('2026-08-21'), '2026-08-21');
  assert.equal(normalizeDate('21/08/2026'), '2026-08-21');
  assert.equal(normalizeDate('2026/8/5'), '2026-08-05');
  assert.equal(normalizeDate('', '2026-01-01'), '2026-01-01');
});

test('normalizeCategory memetakan tulisan bebas ke kategori resmi', () => {
  assert.equal(normalizeCategory('es batu'), 'Es Batu');
  assert.equal(normalizeCategory('Bensin motor'), 'Ongkir/Bensin');
  assert.equal(normalizeCategory('promo diskon'), 'Promosi');
  assert.equal(normalizeCategory('listrik booth'), 'Sewa/Listrik');
  assert.equal(normalizeCategory('entah apa'), 'Lainnya');
});
