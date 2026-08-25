import { WebFooter } from '@/components/web/web-footer';
import { WebHeader } from '@/components/web/web-header';
import { DocsSidebar } from '@/components/docs/docs-sidebar';
import { dashboardPoppins } from '@/lib/fonts/dashboard';
import { cn } from '@/lib/utils';

/**
 * Public docs chrome — Metronic SaaS landing header/footer, not dashboard layout-1.
 */
export function DocsWebShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'min-h-screen bg-background text-foreground',
        dashboardPoppins.variable,
        dashboardPoppins.className,
      )}
    >
      <WebHeader />
      <div className="container mx-auto px-6 pt-28 pb-16">
        <div className="flex items-start gap-10">
          <DocsSidebar />
          <div className="min-w-0 grow">{children}</div>
        </div>
      </div>
      <WebFooter />
    </div>
  );
}
