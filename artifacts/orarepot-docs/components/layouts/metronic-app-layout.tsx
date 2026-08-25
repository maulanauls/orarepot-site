'use client';

import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Layout1 } from '@/components/layouts/layout-1';
import { dashboardPoppins } from '@/lib/fonts/dashboard';

/**
 * Dashboard/admin only — isolated from landing.
 * Poppins on shell + mirrored to <html> so portaled UI also uses Poppins.
 */
export function MetronicAppLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    const extra = [dashboardPoppins.variable, dashboardPoppins.className]
      .flatMap((c) => c.split(' '))
      .filter(Boolean);

    root.classList.add('dashboard-font', ...extra);

    return () => {
      root.classList.remove('dashboard-font', ...extra);
    };
  }, []);

  return (
    <div
      className={cn(
        'dashboard-app flex h-full min-h-full w-full flex-col',
        dashboardPoppins.variable,
        dashboardPoppins.className,
      )}
    >
      <Layout1>{children}</Layout1>
    </div>
  );
}
