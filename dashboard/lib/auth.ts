/**
 * Kunci sederhana untuk dashboard.
 *
 * Password TIDAK pernah ditulis di kode — diambil dari env `APP_PASSWORD`.
 * Kalau env-nya kosong, dashboard terbuka tanpa kunci (praktis untuk `npm run dev`).
 *
 * Cookie tidak menyimpan password, melainkan hash SHA-256 dari password +
 * pembeda aplikasi. Jadi isi cookie tidak bisa dipakai balik untuk menebak
 * password aslinya, dan cookie lama otomatis tidak berlaku begitu password
 * diganti di environment variable.
 */

export const AUTH_COOKIE = 'mango_pos_auth';
export const AUTH_MAX_AGE = 60 * 60 * 24 * 30; // 30 hari

export function authPassword(): string {
  return (process.env.APP_PASSWORD ?? '').trim();
}

export function isAuthEnabled(): boolean {
  return authPassword().length > 0;
}

/** Nilai cookie yang sah untuk password yang sedang aktif. */
export async function expectedToken(): Promise<string> {
  const data = new TextEncoder().encode(`mango-pos:v1:${authPassword()}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Perbandingan waktu-tetap supaya tidak bocor lewat selisih waktu respons. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function isValidToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  return safeEqual(token, await expectedToken());
}
