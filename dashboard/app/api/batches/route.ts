import {
  handleError,
  ok,
  fail,
  readJson,
  requireAmount,
  requireDate,
  requireText,
  optionalText,
} from '@/lib/api';
import { getSnapshot } from '@/lib/snapshot';
import { createBatch, removeRecord } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const snapshot = await getSnapshot();
    return ok({ batches: snapshot.batches });
  } catch (error) {
    return handleError(error);
  }
}

/** Input belanja bahan baku per batch -> otomatis masuk antrean FIFO. */
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const batch = await createBatch({
      date: requireDate(body),
      itemName: requireText(body, 'itemName', 'Nama item bahan'),
      totalCost: requireAmount(body, 'totalCost', 'Total biaya belanja'),
      yieldCup: requireAmount(body, 'yieldCup', 'Estimasi yield cup'),
      note: optionalText(body, 'note'),
    });
    return ok({ batch, snapshot: await getSnapshot() }, 201);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return fail('Parameter id wajib diisi.');
    const removed = await removeRecord('batch', id);
    if (!removed) return fail('Batch tidak ditemukan.', 404);
    return ok({ snapshot: await getSnapshot() });
  } catch (error) {
    return handleError(error);
  }
}
