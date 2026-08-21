/**
 * Parser & normalisasi input mentah.
 *
 * Dipisah dari modul lain supaya bisa diuji langsung tanpa menarik dependensi
 * Google API — dan supaya aturan "angka rupiah selalu integer" hanya ada di
 * satu tempat.
 */

export const EXPENSE_CATEGORIES = [
  'Es Batu',
  'Ongkir/Bensin',
  'Promosi',
  'Sewa/Listrik',
  'Lainnya',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export function newId(prefix: string): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${stamp}${rand}`;
}

/** "Rp 1.250.000" / "1250000" / "1.250,50" -> 1250000 (integer rupiah). */
export function parseRupiah(value: unknown): number {
  if (typeof value === 'number') return Math.round(value);
  const raw = (value ?? '').toString().trim();
  if (!raw) return 0;

  const negative = /^\(.*\)$/.test(raw) || raw.trim().startsWith('-');
  const cleaned = raw.replace(/[^\d.,]/g, '');
  if (!cleaned) return 0;

  // Grup terakhir yang panjangnya 3 digit dianggap pemisah ribuan
  // ("1.250.000" = 1250000), selain itu dianggap desimal ("1250,5" = 1251).
  const tail = cleaned.match(/[.,](\d+)$/);
  let normalized: string;
  if (tail && tail[1].length !== 3) {
    const cut = cleaned.length - tail[1].length - 1;
    normalized = `${cleaned.slice(0, cut).replace(/[.,]/g, '')}.${tail[1]}`;
  } else {
    normalized = cleaned.replace(/[.,]/g, '');
  }

  const n = Number(normalized);
  if (!Number.isFinite(n)) return 0;
  return Math.round(negative ? -n : n);
}

export function parseCount(value: unknown): number {
  const n = parseRupiah(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/**
 * Normalisasi tanggal ke `YYYY-MM-DD`.
 * Menerima ISO, `dd/mm/yyyy` (default locale Indonesia), dan `yyyy/mm/dd`.
 */
export function normalizeDate(value: unknown, fallback?: string): string {
  const raw = (value ?? '').toString().trim();
  const today = fallback ?? new Date().toISOString().slice(0, 10);
  if (!raw) return today;

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;

  const slashed = raw.match(/^(\d{1,4})[/.](\d{1,2})[/.](\d{1,4})/);
  if (slashed) {
    const [, a, b, c] = slashed;
    if (a.length === 4) return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;
    return `${c.padStart(4, '20')}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return today;
}

export function normalizeCategory(value: unknown): ExpenseCategory {
  const raw = (value ?? '').toString().trim().toLowerCase();
  const match = EXPENSE_CATEGORIES.find((c) => c.toLowerCase() === raw);
  if (match) return match;
  if (raw.includes('es')) return 'Es Batu';
  if (raw.includes('ongkir') || raw.includes('bensin')) return 'Ongkir/Bensin';
  if (raw.includes('promo')) return 'Promosi';
  if (raw.includes('sewa') || raw.includes('listrik')) return 'Sewa/Listrik';
  return 'Lainnya';
}

