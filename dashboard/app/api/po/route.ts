import { fail, handleError, ok, optionalText, readJson, requireAmount, requireText } from '@/lib/api';
import { importPoTabs } from '@/lib/poSync';
import { addPoOrder, clearPoOrder, createPoBoard, listPoBoards, updatePoOrder } from '@/lib/poWrite';
import { isSheetsConfigured } from '@/lib/sheets';
import { getSnapshot } from '@/lib/snapshot';
import { recalculate } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Catatan PO per pemesan — cerminan tab "List PO" di spreadsheet.
 * Setiap perubahan langsung diringkas ulang jadi baris penjualan (FIFO ikut
 * dihitung ulang), jadi mencatat lewat web dan lewat Sheets hasilnya sama.
 */

function requireSheets() {
  if (!isSheetsConfigured()) {
    throw new SheetsBelumSiap();
  }
}

class SheetsBelumSiap extends Error {
  constructor() {
    super('Catatan PO butuh Google Sheets. Isi dulu GOOGLE_SHEET_ID, GOOGLE_CLIENT_EMAIL, dan GOOGLE_PRIVATE_KEY.');
  }
}

async function afterChange() {
  const imported = await importPoTabs();
  await recalculate();
  return { imported, boards: await listPoBoards(), snapshot: await getSnapshot() };
}

export async function GET() {
  try {
    if (!isSheetsConfigured()) return ok({ enabled: false, boards: [] });
    return ok({ enabled: true, boards: await listPoBoards() });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    requireSheets();
    const body = await readJson(request);

    if ((body.action ?? '').toString() === 'create-board') {
      const tab = await createPoBoard(requireText(body, 'tab', 'Nama batch'));
      return ok({ tab, ...(await afterChange()) }, 201);
    }

    const tab = requireText(body, 'tab', 'Batch PO');
    await addPoOrder(tab, {
      nama: requireText(body, 'nama', 'Nama pemesan'),
      cups: requireAmount(body, 'cups', 'Jumlah cup'),
      pricePerCup: requireAmount(body, 'pricePerCup', 'Harga per cup'),
      lunas: body.lunas === true || body.lunas === 'true',
      notes: optionalText(body, 'notes') ?? '',
    });

    return ok(await afterChange(), 201);
  } catch (error) {
    if (error instanceof SheetsBelumSiap) return fail(error.message, 409);
    return handleError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    requireSheets();
    const body = await readJson(request);
    const tab = requireText(body, 'tab', 'Batch PO');
    const rowNumber = Number(body.rowNumber ?? 0);
    if (!rowNumber) return fail('Nomor baris pesanan wajib diisi.');

    await updatePoOrder(tab, rowNumber, {
      nama: body.nama !== undefined ? requireText(body, 'nama', 'Nama pemesan') : undefined,
      cups: body.cups !== undefined ? requireAmount(body, 'cups', 'Jumlah cup') : undefined,
      pricePerCup:
        body.pricePerCup !== undefined
          ? requireAmount(body, 'pricePerCup', 'Harga per cup')
          : undefined,
      lunas: body.lunas !== undefined ? body.lunas === true || body.lunas === 'true' : undefined,
      notes: body.notes !== undefined ? (optionalText(body, 'notes') ?? '') : undefined,
    });

    return ok(await afterChange());
  } catch (error) {
    if (error instanceof SheetsBelumSiap) return fail(error.message, 409);
    return handleError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    requireSheets();
    const params = new URL(request.url).searchParams;
    const tab = params.get('tab');
    const rowNumber = Number(params.get('row') ?? 0);
    if (!tab || !rowNumber) return fail('Parameter tab dan row wajib diisi.');

    await clearPoOrder(tab, rowNumber);
    return ok(await afterChange());
  } catch (error) {
    if (error instanceof SheetsBelumSiap) return fail(error.message, 409);
    return handleError(error);
  }
}
