import { checkSecret, fail, handleError, ok, readJson } from '@/lib/api';
import { importPoTabs } from '@/lib/poSync';
import { getSnapshot } from '@/lib/snapshot';
import { recalculate } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** READ: dashboard menarik seluruh data + metrik hasil FIFO. */
export async function GET() {
  try {
    return ok({ snapshot: await getSnapshot() });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Re-kalkulasi paksa: impor ulang tab PO, jalankan FIFO untuk semua baris,
 * lalu tulis balik kolom turunan ke Google Sheets. Dipakai tombol "Sinkron"
 * di dashboard dan webhook Google Apps Script (onEdit/onChange).
 */
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    if (!checkSecret(request, body)) return fail('Secret sinkronisasi tidak cocok.', 401);

    // Tab "List PO" diringkas ulang jadi baris penjualan sebelum FIFO dihitung,
    // jadi pesanan yang ditulis manual di spreadsheet ikut masuk hitungan.
    const imported = await importPoTabs();
    const result = await recalculate();
    return ok({ recalculated: result, imported, snapshot: await getSnapshot() });
  } catch (error) {
    return handleError(error);
  }
}
