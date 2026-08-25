'use client';

import { Fragment, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { MENU_DOCS } from '@/config/docs.config';
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

export function MegaMenu() {
  const pathname = usePathname();
  const current = useMemo(
    () => resolveCurrent(MENU_DOCS, pathname),
    [pathname],
  );

  return (
    <div className="hidden lg:flex items-center gap-1.5 min-w-0 ps-8">
      <Link
        href="/"
        className={cn(
          'text-sm font-medium shrink-0 hover:text-primary',
          pathname === '/' ? 'text-primary' : 'text-secondary-foreground',
        )}
      >
        Docs
      </Link>
      {current && current.path !== '/' ? (
        <Fragment>
          <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium text-primary truncate">
            {current.title}
          </span>
        </Fragment>
      ) : null}
    </div>
  );
}
