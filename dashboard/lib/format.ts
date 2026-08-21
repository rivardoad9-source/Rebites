/** Formatter tampilan. Semua nominal dibulatkan ke integer rupiah dulu. */

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

export function rupiah(value: number): string {
  return rupiahFormatter.format(Math.round(value || 0)).replace(/ /g, ' ');
}

/** Versi ringkas untuk layar HP: Rp 1,2 jt / Rp 850 rb. */
export function rupiahShort(value: number): string {
  const n = Math.round(value || 0);
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}Rp ${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace('.', ',')} jt`;
  if (abs >= 100_000) return `${sign}Rp ${Math.round(abs / 1000)} rb`;
  return rupiah(n);
}

export function angka(value: number): string {
  return numberFormatter.format(Math.round(value || 0));
}

export function persen(value: number): string {
  const rounded = Math.round((value || 0) * 10) / 10;
  return `${rounded.toString().replace('.', ',')}%`;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

/** `2026-08-21` -> `21 Agu 2026`. */
export function tanggal(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!m) return iso ?? '-';
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

export function tanggalPendek(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!m) return iso ?? '-';
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}`;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
}

export function namaBulan(iso: string = todayISO()): string {
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  if (!m) return '';
  const full = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  return `${full[Number(m[2]) - 1]} ${m[1]}`;
}
