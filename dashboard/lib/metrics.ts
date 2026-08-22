import type {
  BatchState,
  ChartPoint,
  DailyRow,
  Expense,
  HealthLevel,
  Metrics,
  SaleComputed,
} from './types';

/** `YYYY-MM-DD` untuk zona waktu lokal (bukan UTC, supaya tanggal booth benar). */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

export function healthOf(netMargin: number): HealthLevel {
  if (netMargin >= 40) return 'SEHAT';
  if (netMargin >= 20) return 'WASPADA';
  return 'KRITIS';
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export function computeMetrics(
  batches: BatchState[],
  sales: SaleComputed[],
  expenses: Expense[],
): Metrics {
  const totalOmzet = sales.reduce((sum, s) => sum + s.revenue, 0);
  const totalHpp = sales.reduce((sum, s) => sum + s.cogs, 0);
  const totalOpex = expenses.reduce((sum, e) => sum + Math.round(e.amount), 0);
  const cupsSold = sales.reduce((sum, s) => sum + s.cups, 0);

  const grossProfit = totalOmzet - totalHpp;
  const netProfit = grossProfit - totalOpex;

  const active = batches.filter((b) => b.status === 'ACTIVE');

  return {
    totalOmzet,
    totalHpp,
    totalOpex,
    grossProfit,
    netProfit,
    netMargin: pct(netProfit, totalOmzet),
    grossMargin: pct(grossProfit, totalOmzet),
    cupsSold,
    avgPricePerCup: cupsSold > 0 ? Math.round(totalOmzet / cupsSold) : 0,
    avgCogsPerCup: cupsSold > 0 ? Math.round(totalHpp / cupsSold) : 0,
    health: healthOf(pct(netProfit, totalOmzet)),
    stockRemainingCup: active.reduce((sum, b) => sum + b.remainingCup, 0),
    stockRemainingValue: active.reduce((sum, b) => sum + b.remainingValue, 0),
  };
}

/** Rekap per tanggal (dipakai tabel riwayat + basis grafik). */
export function computeDaily(sales: SaleComputed[], expenses: Expense[]): DailyRow[] {
  const map = new Map<string, DailyRow>();

  const row = (date: string): DailyRow => {
    let r = map.get(date);
    if (!r) {
      r = { date, cups: 0, omzet: 0, hpp: 0, opex: 0, grossProfit: 0, netProfit: 0 };
      map.set(date, r);
    }
    return r;
  };

  for (const s of sales) {
    const r = row(s.date);
    r.cups += s.cups;
    r.omzet += s.revenue;
    r.hpp += s.cogs;
  }
  for (const e of expenses) {
    row(e.date).opex += Math.round(e.amount);
  }

  return [...map.values()]
    .map((r) => ({
      ...r,
      grossProfit: r.omzet - r.hpp,
      netProfit: r.omzet - r.hpp - r.opex,
    }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * Deret kumulatif Omzet vs Pengeluaran (HPP terpakai + OPEX) sepanjang bulan
 * berjalan, plus garis proyeksi omzet akhir bulan berbasis rata-rata harian
 * dari hari-hari yang sudah berjalan.
 */
export function computeChart(daily: DailyRow[], today = new Date()): ChartPoint[] {
  const year = today.getFullYear();
  const month = today.getMonth();
  const key = `${year}-${`${month + 1}`.padStart(2, '0')}`;
  const total = daysInMonth(year, month);
  const todayDay = toISODate(today).startsWith(key) ? today.getDate() : total;

  const byDay = new Map<number, DailyRow>();
  for (const r of daily) {
    if (monthKey(r.date) !== key) continue;
    byDay.set(Number(r.date.slice(8, 10)), r);
  }

  let cumOmzet = 0;
  let cumPengeluaran = 0;
  let omzetSampaiHariIni = 0;
  const actual: { day: number; omzet: number; pengeluaran: number }[] = [];

  for (let day = 1; day <= total; day += 1) {
    const r = byDay.get(day);
    cumOmzet += r ? r.omzet : 0;
    cumPengeluaran += r ? r.hpp + r.opex : 0;
    if (day <= todayDay) {
      omzetSampaiHariIni = cumOmzet;
      actual.push({ day, omzet: cumOmzet, pengeluaran: cumPengeluaran });
    }
  }

  const dailyAvg = todayDay > 0 ? omzetSampaiHariIni / todayDay : 0;

  return Array.from({ length: total }, (_, i) => {
    const day = i + 1;
    const a = actual[i];
    return {
      day,
      label: `${day}`,
      omzet: a ? a.omzet : null,
      pengeluaran: a ? a.pengeluaran : null,
      proyeksi: Math.round(dailyAvg * day),
    };
  });
}
