'use client';

import { Fragment, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { MENU_SIDEBAR, MENU_SIDEBAR_ADMIN } from '@/config/layout-1.config';
import { MenuItem } from '@/config/types';
import { cn } from '@/lib/utils';
import { useMenu } from '@/hooks/use-menu';
import { useT } from '@/components/i18n/locale-provider';
import { MENU_I18N } from '@/lib/i18n/menu-keys';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

export interface ToolbarHeadingProps {
  title?: string | ReactNode;
  description?: string | ReactNode;
}

function Toolbar({ children }: { children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-5 pb-7.5">
      {children}
    </div>
  );
}

function ToolbarActions({ children }: { children?: ReactNode }) {
  return <div className="flex items-center gap-2.5">{children}</div>;
}

function menuLabel(item: MenuItem, t: (key: string) => string) {
  if (item.heading && MENU_I18N[item.heading]) return t(MENU_I18N[item.heading]);
  if (item.path && MENU_I18N[item.path]) return t(MENU_I18N[item.path]);
  return item.title ?? '';
}

function ToolbarBreadcrumbs() {
  const pathname = usePathname();
  const t = useT();
  const { getBreadcrumb, isActive } = useMenu(pathname);
  const items: MenuItem[] = getBreadcrumb(
    pathname.startsWith('/admin') ? MENU_SIDEBAR_ADMIN : MENU_SIDEBAR,
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex [.header_&]:below-lg:hidden items-center gap-1.25 text-xs lg:text-sm font-medium mb-2.5 lg:mb-0">
      <div className="breadcrumb flex items-center gap-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const active = item.path ? isActive(item.path) : false;

          return (
            <Fragment key={index}>
              {item.path ? (
                <Link
                  href={item.path}
                  className={cn(
                    'flex items-center gap-1',
                    active
                      ? 'text-mono'
                      : 'text-muted-foreground hover:text-primary',
                  )}
                >
                  {menuLabel(item, t)}
                </Link>
              ) : (
                <span
                  className={cn(isLast ? 'text-mono' : 'text-muted-foreground')}
                >
                  {menuLabel(item, t)}
                </span>
              )}
              {!isLast && (
                <ChevronRight className="size-3.5 muted-foreground" />
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

function ToolbarHeading ({ children }: { children: ReactNode }) {
  return <div className="flex flex-col justify-center gap-2">{children}</div>;
}

function ToolbarPageTitle ({ children }: { children?: string }) {
  const pathname = usePathname();
  const t = useT();
  const { getCurrentItem } = useMenu(pathname);
  const item = getCurrentItem(
    pathname.startsWith('/admin') ? MENU_SIDEBAR_ADMIN : MENU_SIDEBAR,
  );
  const fallback = item
    ? menuLabel(item, t)
    : MENU_I18N[pathname]
      ? t(MENU_I18N[pathname])
      : t('menu.overview');

  return (
    <h1 className="text-xl font-medium leading-none text-mono">
      {children ? children : fallback}
    </h1>
  );
};

function ToolbarDescription ({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm font-normal text-secondary-foreground">
      {children}
    </div>
  );
};

export { Toolbar, ToolbarActions, ToolbarBreadcrumbs, ToolbarHeading, ToolbarPageTitle, ToolbarDescription };
