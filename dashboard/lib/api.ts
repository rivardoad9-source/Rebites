import { NextResponse } from 'next/server';
import { EXPENSE_CATEGORIES, type ExpenseCategory } from './types';
import { normalizeDate, parseRupiah } from './store';

export function ok<T>(data: T, init?: number) {
  return NextResponse.json({ ok: true, ...data }, { status: init ?? 200 });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export function serverError(error: unknown) {
  const message =
    error instanceof Error ? error.message : 'Terjadi kesalahan tak terduga di server.';
  // Kesalahan kredensial Sheets paling sering muncul di sini — pesan aslinya
  // dikirim ke UI supaya bisa diperbaiki tanpa buka log server.
  return NextResponse.json({ ok: false, error: message }, { status: 500 });
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return (body ?? {}) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function requireDate(body: Record<string, unknown>, field = 'date'): string {
  return normalizeDate(body[field]);
}

export function requireAmount(
  body: Record<string, unknown>,
  field: string,
  label: string,
  { min = 1 }: { min?: number } = {},
): number {
  const value = parseRupiah(body[field]);
  if (!Number.isFinite(value) || value < min) {
    throw new ValidationError(`${label} wajib diisi dan minimal ${min}.`);
  }
  return Math.round(value);
}

export function optionalText(body: Record<string, unknown>, field: string): string | undefined {
  const raw = body[field];
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed ? trimmed.slice(0, 300) : undefined;
}

export function requireText(
  body: Record<string, unknown>,
  field: string,
  label: string,
): string {
  const value = optionalText(body, field);
  if (!value) throw new ValidationError(`${label} wajib diisi.`);
  return value;
}

export function requireCategory(body: Record<string, unknown>): ExpenseCategory {
  const raw = (body.category ?? '').toString().trim();
  const found = EXPENSE_CATEGORIES.find((c) => c === raw);
  if (!found) {
    throw new ValidationError(`Kategori harus salah satu dari: ${EXPENSE_CATEGORIES.join(', ')}.`);
  }
  return found;
}

export class ValidationError extends Error {}

export function handleError(error: unknown) {
  if (error instanceof ValidationError) return fail(error.message, 422);
  return serverError(error);
}

/**
 * Webhook dari Google Apps Script diverifikasi lewat `SYNC_SECRET`.
 * Kalau env-nya tidak diset, endpoint tetap terbuka (mode setup/demo).
 */
export function checkSecret(request: Request, body: Record<string, unknown>): boolean {
  const secret = process.env.SYNC_SECRET;
  if (!secret) return true;
  const header = request.headers.get('x-sync-secret');
  const url = new URL(request.url).searchParams.get('secret');
  return header === secret || url === secret || body.secret === secret;
}
