import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/theme-provider';
import { LocaleProvider } from '@/components/i18n/locale-provider';
import { SiteChrome } from '@/components/layout/site-chrome';
import { TooltipProvider } from '@/components/ui/tooltip';
import { dashboardPoppins } from '@/lib/fonts/dashboard';
import { organizationJsonLd } from '@/lib/seo';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'ORAREPOT',
    template: '%s | ORAREPOT',
  },
  description:
    'WhatsApp OTP API dan broadcast lewat WhatsApp Business API resmi, plus AI assistant dan produk digital.',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://orarepot.com',
  ),
  openGraph: {
    title: 'ORAREPOT',
    description:
      'WhatsApp OTP API dan broadcast lewat WhatsApp Business API resmi, plus AI assistant dan produk digital.',
    type: 'website',
    images: [{ url: '/logo-orarepot-icon.png', alt: 'Ora Repot' }],
  },
  twitter: {
    card: 'summary',
    title: 'ORAREPOT',
    description:
      'WhatsApp OTP API dan broadcast lewat WhatsApp Business API resmi, plus AI assistant dan produk digital.',
    images: ['/logo-orarepot-icon.png'],
  },
  icons: {
    icon: [
      { url: '/logo-orarepot-icon.png', type: 'image/png' },
      { url: '/logo-orarepot-icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/logo-orarepot-icon.png',
  },
};

/**
 * Shared root only — no flex on body (that broke landing/auth).
 * Marketing chrome / dashboard / auth each own their shell.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="id"
      className={`h-full w-full ${dashboardPoppins.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased m-0 min-h-full h-full w-full text-base text-foreground bg-background">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }}
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <LocaleProvider>
            <TooltipProvider delayDuration={0}>
              <SiteChrome>{children}</SiteChrome>
            </TooltipProvider>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
