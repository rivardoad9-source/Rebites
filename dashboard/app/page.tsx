import Dashboard from '@/components/Dashboard';
import { isAuthEnabled } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default function Page() {
  // Tombol "Keluar" hanya masuk akal kalau dashboard memang dikunci password.
  return <Dashboard authEnabled={isAuthEnabled()} />;
}
