import { dashboardPoppins } from '@/lib/fonts/dashboard';
import { cn } from '@/lib/utils';

export default function PayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={cn('pay-app', dashboardPoppins.variable, dashboardPoppins.className)}>
      {children}
    </div>
  );
}
