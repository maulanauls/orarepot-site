import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/theme-provider';
import { LocaleProvider } from '@/components/i18n/locale-provider';
import { SiteChrome } from '@/components/layout/site-chrome';
import { TooltipProvider } from '@/components/ui/tooltip';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'ORAREPOT',
    template: '%s | ORAREPOT',
  },
  description:
    'Ora Repot menyatukan Agentic AI customer relationship, broadcast & OTP resmi WhatsApp (WABA), serta pembelian pulsa dan voucher digital.',
  metadataBase: new URL('http://localhost:5173'),
  openGraph: {
    title: 'ORAREPOT',
    description: 'AI Assistant, WABA messaging, dan digital goods dalam satu platform.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ORAREPOT',
    description: 'AI Assistant, WABA messaging, dan digital goods dalam satu platform.',
  },
  icons: {
    icon: '/logo-orarepot-icon.png',
  },
};

/**
 * Shared root only — no flex on body (that broke landing/auth).
 * Marketing chrome / dashboard / auth each own their shell.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="h-full w-full" suppressHydrationWarning>
      <body className="antialiased m-0 min-h-full h-full w-full text-base text-foreground bg-background">
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
