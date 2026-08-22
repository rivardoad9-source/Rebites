import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { AUTH_COOKIE, isAuthEnabled, isValidToken } from '@/lib/auth';
import LoginForm from '@/components/LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  // Kalau kunci tidak aktif atau sudah masuk, tidak ada gunanya menampilkan form.
  if (!isAuthEnabled()) redirect('/');
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (await isValidToken(token)) redirect('/');

  const { next } = await searchParams;
  const target = next && next.startsWith('/') ? next : '/';

  return <LoginForm next={target} />;
}
