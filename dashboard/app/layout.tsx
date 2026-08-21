import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mango Cheese — Dashboard & POS',
  description:
    'Dashboard realtime HPP FIFO, penjualan, OPEX, dan proyeksi laba Mango Cheese Milk, tersinkron dua arah dengan Google Sheets.',
  applicationName: 'Mango Cheese POS',
  appleWebApp: { capable: true, title: 'Mango POS', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#FFF8EC',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
