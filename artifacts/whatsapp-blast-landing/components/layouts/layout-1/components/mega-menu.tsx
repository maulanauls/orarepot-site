'use client';

import { Fragment, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { MENU_SIDEBAR, MENU_SIDEBAR_ADMIN } from '@/config/layout-1.config';
import { MenuItem } from '@/config/types';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

function resolveCurrent(items: MenuItem[], pathname: string): MenuItem | undefined {
  const leaves = items.filter((item) => item.path && item.title);
  const exact = leaves.find((item) => item.path === pathname);
  if (exact) return exact;

  return leaves
    .filter((item) => item.path && item.path !== '/' && pathname.startsWith(`${item.path}/`))
    .sort((a, b) => (b.path?.length || 0) - (a.path?.length || 0))[0];
}

/** Header left nav — Metronic mega-menu slot, Ora breadcrumb content */
export function MegaMenu() {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith('/admin');
  const rootHref = isAdmin ? '/admin' : '/dashboard';
  const rootLabel = isAdmin ? 'Admin' : 'Dashboard';
  const menu = isAdmin ? MENU_SIDEBAR_ADMIN : MENU_SIDEBAR;

  const current = useMemo(() => resolveCurrent(menu, pathname), [menu, pathname]);

  return (
    <div className="hidden lg:flex items-center gap-1.5 min-w-0 ps-8">
      <Link
        href={rootHref}
        className={cn(
          'text-sm font-medium shrink-0 hover:text-primary',
          pathname === rootHref ? 'text-primary' : 'text-secondary-foreground',
        )}
      >
        {rootLabel}
      </Link>
      {current && current.path !== rootHref && (
        <Fragment>
          <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium text-primary truncate">
            {current.title}
          </span>
        </Fragment>
      )}
    </div>
  );
}
