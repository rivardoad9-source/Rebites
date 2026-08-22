'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CupSoda, Loader2, Lock } from 'lucide-react';

/** Halaman kunci dashboard. */
export default function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password) {
      setError('Password belum diisi.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const body = (await response.json()) as { ok?: boolean; error?: string };

      if (body.ok) {
        router.replace(next);
        router.refresh();
        return;
      }
      setError(body.error ?? 'Password salah.');
      setPassword('');
    } catch {
      setError('Tidak bisa menghubungi server. Cek koneksi lalu coba lagi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-10">
      <div className="card">
        <div className="mb-5 text-center">
          <span className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-mango/10 text-mango-deep">
            <CupSoda className="h-7 w-7" aria-hidden />
          </span>
          <p className="text-xs font-semibold tracking-[0.18em] text-mango-deep uppercase">
            Re-Bites POS
          </p>
          <h1 className="text-xl leading-tight font-extrabold text-ink">Mango Cheese Dashboard</h1>
          <p className="mt-1 text-sm text-ink/55">Masukkan password untuk membuka dashboard.</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink/35"
                aria-hidden
              />
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                inputMode="text"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••"
                autoFocus
                className="field pl-10"
              />
            </div>
          </div>

          {error ? (
            <p className="rounded-xl border border-bad/30 bg-bad-soft px-3 py-2 text-sm text-bad" role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {busy ? 'Membuka…' : 'Masuk'}
          </button>
        </form>
      </div>

      <p className="mt-4 text-center text-xs text-ink/45">
        Sesi tersimpan 30 hari di HP ini, jadi tidak perlu isi password tiap buka.
      </p>
    </main>
  );
}
