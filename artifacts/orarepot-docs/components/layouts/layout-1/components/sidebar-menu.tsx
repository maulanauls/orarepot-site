'use client';

import { JSX, useCallback } from 'react';
import { MENU_DOCS } from '@/config/docs.config';
import { MenuConfig, MenuItem } from '@/config/types';
import {
  AccordionMenu,
  AccordionMenuClassNames,
  AccordionMenuGroup,
  AccordionMenuItem,
  AccordionMenuLabel,
  AccordionMenuSub,
  AccordionMenuSubContent,
  AccordionMenuSubTrigger,
} from '@/components/ui/accordion-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

export function SidebarMenu() {
  const pathname = usePathname();
  const menu = MENU_DOCS;

  const labelFor = useCallback((item: MenuItem) => {
    return item.heading ?? item.title ?? '';
  }, []);

  const matchPath = useCallback(
    (path: string): boolean => path === pathname,
    [pathname],
  );

  const classNames: AccordionMenuClassNames = {
    root: 'lg:ps-1 space-y-3',
    group: 'gap-px',
    label:
      'uppercase text-xs font-medium text-muted-foreground/70 pt-2.25 pb-px',
    separator: '',
    item: 'h-8 hover:bg-transparent text-accent-foreground hover:text-primary data-[selected=true]:text-primary data-[selected=true]:bg-muted data-[selected=true]:font-medium',
    sub: '',
    subTrigger:
      'h-8 hover:bg-transparent text-accent-foreground hover:text-primary data-[selected=true]:text-primary data-[selected=true]:bg-muted data-[selected=true]:font-medium',
    subContent: 'py-0',
    indicator: '',
  };

  const buildMenu = (items: MenuConfig): JSX.Element[] => {
    return items.map((item: MenuItem, index: number) => {
      if (item.heading) {
        return (
          <AccordionMenuLabel key={index}>{labelFor(item)}</AccordionMenuLabel>
        );
      }
      return buildMenuItemRoot(item, index);
    });
  };

  const buildMenuItemRoot = (item: MenuItem, index: number): JSX.Element => {
    if (item.children) {
      return (
        <AccordionMenuSub key={index} value={item.path || `root-${index}`}>
          <AccordionMenuSubTrigger className="text-sm font-medium">
            {item.icon && <item.icon data-slot="accordion-menu-icon" />}
            <span data-slot="accordion-menu-title">{labelFor(item)}</span>
          </AccordionMenuSubTrigger>
          <AccordionMenuSubContent
            type="single"
            collapsible
            parentValue={item.path || `root-${index}`}
            className="ps-6"
          >
            <AccordionMenuGroup>
              {item.children.map((child, childIndex) => (
                <AccordionMenuItem
                  key={childIndex}
                  value={child.path || ''}
                  className="text-[13px]"
                >
                  <Link href={child.path || '#'}>{labelFor(child)}</Link>
                </AccordionMenuItem>
              ))}
            </AccordionMenuGroup>
          </AccordionMenuSubContent>
        </AccordionMenuSub>
      );
    }

    return (
      <AccordionMenuItem
        key={index}
        value={item.path || ''}
        className="text-sm font-medium"
      >
        <Link href={item.path || '#'} className="flex items-center grow gap-2.5">
          {item.icon && <item.icon data-slot="accordion-menu-icon" />}
          <span data-slot="accordion-menu-title">{labelFor(item)}</span>
        </Link>
      </AccordionMenuItem>
    );
  };

  return (
    <ScrollArea className="flex grow shrink-0 py-5 px-5 lg:h-[calc(100vh-5.5rem)]">
      <AccordionMenu
        selectedValue={pathname}
        matchPath={matchPath}
        type="single"
        collapsible
        classNames={classNames}
      >
        {buildMenu(menu)}
      </AccordionMenu>
    </ScrollArea>
  );
}
