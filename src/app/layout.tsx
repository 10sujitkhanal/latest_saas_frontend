import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { BrandingProvider } from '@/lib/branding';
import TenantGate from '@/components/TenantGate';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Merkoll Organization',
  description: 'Manage your workspaces, plans, and team.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // ``suppressHydrationWarning`` on <html> and <body> silences benign
    // mismatches from browser extensions (ColorZilla adds ``cz-shortcut-listen``
    // to <body>, Grammarly/LastPass inject attributes too) that otherwise
    // log a noisy hydration warning every page load. Only attribute drift
    // on these specific elements is suppressed — child trees still warn.
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-[#030712] text-slate-50" suppressHydrationWarning>
        <Toaster position="top-right" richColors />
        <BrandingProvider>
          <TenantGate>{children}</TenantGate>
        </BrandingProvider>
      </body>
    </html>
  );
}
