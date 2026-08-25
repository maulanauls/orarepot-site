'use client';

import { Fragment, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { MENU_DOCS } from '@/config/docs.config';
import { MENU_SIDEBAR, MENU_SIDEBAR_ADMIN } from '@/config/layout-1.config';
import { isDocsPath } from '@/lib/layout-mode';
import { MenuItem } from '@/config/types';
import { cn } from '@/lib/utils';
import { useT } from '@/components/i18n/locale-provider';
import { MENU_I18N } from '@/lib/i18n/menu-keys';
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
  const t = useT();
  const docs = isDocsPath(pathname);
  const isAdmin = pathname.startsWith('/admin');
  const rootHref = docs ? '/docs' : isAdmin ? '/admin' : '/dashboard';
  const rootLabel = docs
    ? 'Docs'
    : t(isAdmin ? 'menu.adminHeading' : 'menu.dashboard');
  const menu = docs ? MENU_DOCS : isAdmin ? MENU_SIDEBAR_ADMIN : MENU_SIDEBAR;

  const current = useMemo(() => resolveCurrent(menu, pathname), [menu, pathname]);
  const currentLabel = current
    ? docs
      ? current.title
      : current.path && MENU_I18N[current.path]
        ? t(MENU_I18N[current.path])
        : current.title
    : '';

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
            {currentLabel}
          </span>
        </Fragment>
      )}
    </div>
  );
}
