'use client';

import { usePathname } from 'next/navigation';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';

function isAppShell(pathname: string) {
  return (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/sign-in') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/demo')
  );
}

/**
 * Marketing-only chrome. Dashboard/admin/auth render without landing navbar/footer.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const appShell = isAppShell(pathname);

  if (appShell) {
    return <>{children}</>;
  }

  return (
    <>
      <Navbar />
      {children}
      <Footer />
    </>
  );
}
