'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MENU_DOCS } from '@/config/docs.config';
import { MenuItem } from '@/config/types';
import { cn } from '@/lib/utils';

function groupsFromMenu(items: MenuItem[]) {
  const groups: { heading: string; items: MenuItem[] }[] = [];
  let current: { heading: string; items: MenuItem[] } = { heading: '', items: [] };

  for (const item of items) {
    if (item.heading) {
      if (current.heading || current.items.length) groups.push(current);
      current = { heading: item.heading, items: [] };
    } else {
      current.items.push(item);
    }
  }
  if (current.heading || current.items.length) groups.push(current);
  return groups;
}

export function DocsSidebar() {
  const pathname = usePathname();
  const groups = groupsFromMenu(MENU_DOCS);

  return (
    <aside className="hidden lg:block w-[220px] shrink-0 sticky top-24">
      <nav className="grid gap-7">
        {groups.map((group) => (
          <div key={group.heading}>
            {group.heading ? (
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {group.heading}
              </p>
            ) : null}
            <div className="grid gap-0.5">
              {group.items.map((item) => {
                const active = item.path === pathname;
                return (
                  <Link
                    key={item.path}
                    href={item.path || '#'}
                    className={cn(
                      'rounded-md px-2 py-1.5 text-sm transition-colors',
                      active
                        ? 'bg-accent font-medium text-primary'
                        : 'text-accent-foreground hover:text-primary hover:bg-accent/60',
                    )}
                  >
                    {item.title}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
