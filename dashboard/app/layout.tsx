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
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFF8EC' },
    { media: '(prefers-color-scheme: dark)', color: '#14100D' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        {/*
          Pasang tema sebelum paint pertama supaya tidak ada kedip putih waktu
          dashboard dibuka malam-malam di booth.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('mango-pos:theme:v1');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
