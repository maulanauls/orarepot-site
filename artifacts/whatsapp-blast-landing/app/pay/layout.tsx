import type { Metadata } from 'next';
import { dashboardPoppins } from '@/lib/fonts/dashboard';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={cn('pay-app', dashboardPoppins.variable, dashboardPoppins.className)}>
      {children}
    </div>
  );
}
