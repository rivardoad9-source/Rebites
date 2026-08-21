import {
  fail,
  handleError,
  ok,
  optionalText,
  readJson,
  requireAmount,
  requireDate,
} from '@/lib/api';
import { getSnapshot } from '@/lib/snapshot';
import { createSale, removeRecord } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const snapshot = await getSnapshot();
    return ok({ sales: snapshot.sales });
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Input penjualan harian. Alokasi FIFO dijalankan ulang setelah baris masuk,
 * jadi response sudah membawa HPP terpakai + laba kotor transaksi ini.
 */
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const sale = await createSale({
      date: requireDate(body),
      cups: requireAmount(body, 'cups', 'Jumlah cup terjual'),
      pricePerCup: requireAmount(body, 'pricePerCup', 'Harga jual per cup'),
      channel: optionalText(body, 'channel'),
      note: optionalText(body, 'note'),
    });

    const snapshot = await getSnapshot();
    const computed = snapshot.sales.find((s) => s.id === sale.id) ?? null;
    return ok({ sale: computed ?? sale, snapshot }, 201);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return fail('Parameter id wajib diisi.');
    const removed = await removeRecord('sale', id);
    if (!removed) return fail('Transaksi penjualan tidak ditemukan.', 404);
    return ok({ snapshot: await getSnapshot() });
  } catch (error) {
    return handleError(error);
  }
}
