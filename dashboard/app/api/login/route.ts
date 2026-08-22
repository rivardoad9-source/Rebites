import { NextResponse } from 'next/server';
import { AUTH_COOKIE, AUTH_MAX_AGE, authPassword, expectedToken, isAuthEnabled, safeEqual } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Verifikasi password lalu pasang cookie sesi. */
export async function POST(request: Request) {
  if (!isAuthEnabled()) {
    return NextResponse.json({ ok: true, unlocked: true });
  }

  let password = '';
  try {
    const body = (await request.json()) as { password?: unknown };
    password = (body.password ?? '').toString();
  } catch {
    password = '';
  }

  if (!safeEqual(password, authPassword())) {
    // Jeda kecil supaya percobaan tebak password tidak bisa dibrutal cepat.
    await new Promise((resolve) => setTimeout(resolve, 600));
    return NextResponse.json({ ok: false, error: 'Password salah.' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: AUTH_COOKIE,
    value: await expectedToken(),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: AUTH_MAX_AGE,
  });
  return response;
}

/** Keluar: cookie dihapus. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({ name: AUTH_COOKIE, value: '', path: '/', maxAge: 0 });
  return response;
}
