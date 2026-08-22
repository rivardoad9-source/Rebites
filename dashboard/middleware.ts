import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE, isAuthEnabled, isValidToken } from '@/lib/auth';

/**
 * Semua halaman dan API dikunci kalau `APP_PASSWORD` diisi.
 *
 * Dua pengecualian: halaman login itu sendiri, dan webhook `POST /api/sync`
 * dari Google Apps Script — webhook tidak punya cookie, dia diverifikasi
 * lewat `SYNC_SECRET` di route handler-nya.
 */
export async function middleware(request: NextRequest) {
  if (!isAuthEnabled()) return NextResponse.next();

  const { pathname } = request.nextUrl;

  if (pathname === '/login' || pathname === '/api/login') return NextResponse.next();

  if (pathname === '/api/sync' && request.method === 'POST') {
    const secret = process.env.SYNC_SECRET;
    const header = request.headers.get('x-sync-secret');
    if (secret && header === secret) return NextResponse.next();
  }

  if (await isValidToken(request.cookies.get(AUTH_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { ok: false, error: 'Belum masuk. Buka dashboard dan isi password dulu.' },
      { status: 401 },
    );
  }

  const login = request.nextUrl.clone();
  login.pathname = '/login';
  login.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest).*)'],
};
