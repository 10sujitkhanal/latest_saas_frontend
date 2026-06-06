import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { BrandingProvider } from '@/lib/branding';
import TenantGate from '@/components/TenantGate';
import { SITE_URL, SITE_NAME, SITE_TITLE, SITE_DESCRIPTION, SITE_KEYWORDS, OG_IMAGE } from '@/lib/seo';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: SITE_KEYWORDS,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  alternates: { canonical: '/' },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    url: SITE_URL,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: 'en_US',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: `${SITE_NAME} — all-in-one business operating system` }],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
    site: '@merkoll',
    creator: '@merkoll',
  },
  icons: { icon: '/favicon.ico', shortcut: '/favicon.ico', apple: '/favicon.ico' },
  category: 'business software',
};

export const viewport: Viewport = {
  themeColor: '#0B1120',
  colorScheme: 'dark',
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
