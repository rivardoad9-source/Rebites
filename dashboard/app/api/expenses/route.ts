import {
  fail,
  handleError,
  ok,
  optionalText,
  readJson,
  requireAmount,
  requireCategory,
  requireDate,
} from '@/lib/api';
import { getSnapshot } from '@/lib/snapshot';
import { createExpense, removeRecord, updateExpense } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const snapshot = await getSnapshot();
    return ok({ expenses: snapshot.expenses });
  } catch (error) {
    return handleError(error);
  }
}

/** Input pengeluaran operasional (OPEX). */
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const expense = await createExpense({
      date: requireDate(body),
      category: requireCategory(body),
      amount: requireAmount(body, 'amount', 'Nominal pengeluaran'),
      note: optionalText(body, 'note'),
    });
    return ok({ expense, snapshot: await getSnapshot() }, 201);
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await readJson(request);
    const id = (body.id ?? '').toString().trim();
    if (!id) return fail('Field id wajib diisi.');

    const updated = await updateExpense(id, {
      date: body.date !== undefined ? requireDate(body) : undefined,
      category: body.category !== undefined ? requireCategory(body) : undefined,
      amount:
        body.amount !== undefined
          ? requireAmount(body, 'amount', 'Nominal pengeluaran')
          : undefined,
      note: body.note !== undefined ? optionalText(body, 'note') : undefined,
    });
    if (!updated) return fail('Pengeluaran tidak ditemukan.', 404);
    return ok({ expense: updated, snapshot: await getSnapshot() });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return fail('Parameter id wajib diisi.');
    const removed = await removeRecord('expense', id);
    if (!removed) return fail('Pengeluaran tidak ditemukan.', 404);
    return ok({ snapshot: await getSnapshot() });
  } catch (error) {
    return handleError(error);
  }
}
