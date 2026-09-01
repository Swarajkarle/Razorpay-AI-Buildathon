import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AppShell } from '@/components/AppShell';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AI Revenue Recovery Agent | Track 03',
  description: 'Find revenue that\'s slipping away and win it back. AI-powered detection, diagnosis, and recovery across payment failures, checkout abandonment, and overdue receivables.',
  keywords: 'revenue recovery, AI agent, payment failure, dunning, collections, fintech',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/favicon.jpg" type="image/jpeg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={inter.className} style={{ background: '#0a0b0f', minHeight: '100vh' }}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
