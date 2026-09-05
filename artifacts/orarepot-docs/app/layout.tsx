import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { MetronicAppLayout } from '@/components/layouts/metronic-app-layout';
import { dashboardPoppins } from '@/lib/fonts/dashboard';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'DOCS',
    template: '%s | ORA REPOT DOCS',
  },
  description: 'OTP WhatsApp API — api.orarepot.com',
  icons: {
    icon: '/logo-orarepot-icon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="id"
      className={`h-full w-full dark ${dashboardPoppins.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased m-0 min-h-full h-full w-full text-base text-foreground bg-background">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <TooltipProvider delayDuration={0}>
            <MetronicAppLayout>{children}</MetronicAppLayout>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
