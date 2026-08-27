'use client';

import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { toAbsoluteUrl } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useScrollPosition } from '@/hooks/use-scroll-position';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTrigger,
} from '@/components/ui/sheet';
import { DocsSearchDialog } from '@/components/docs/docs-search-dialog';
import { MegaMenu } from './mega-menu';
import { SidebarMenu } from './sidebar-menu';
import { DASHBOARD_URL } from '@/lib/hosts';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

export function Header() {
  const [isSidebarSheetOpen, setIsSidebarSheetOpen] = useState(false);
  const pathname = usePathname();
  const mobileMode = useIsMobile();
  const scrollPosition = useScrollPosition();
  const headerSticky = scrollPosition > 0;

  useEffect(() => {
    setIsSidebarSheetOpen(false);
  }, [pathname]);

  return (
    <header
      className={cn(
        'header fixed top-0 z-10 start-0 end-0 flex items-stretch shrink-0 bg-background pe-[var(--removed-body-scroll-bar-size,0px)]',
        headerSticky ? 'border-b border-border' : 'border-b border-transparent',
      )}
    >
      <div className="container-fluid flex items-center justify-between gap-4 h-full">
        <div className="flex lg:hidden items-center gap-2.5">
          <Link href="/" className="shrink-0">
            <img
              src={toAbsoluteUrl('/logo-orarepot-icon.png')}
              className="h-[25px] w-auto"
              alt="Ora Repot"
            />
          </Link>
          {mobileMode && (
            <Sheet open={isSidebarSheetOpen} onOpenChange={setIsSidebarSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" mode="icon">
                  <Menu className="text-muted-foreground/70" />
                </Button>
              </SheetTrigger>
              <SheetContent
                className="p-0 gap-0 w-[275px]"
                side="left"
                close={false}
              >
                <SheetHeader className="p-0 space-y-0" />
                <SheetBody className="p-0 overflow-y-auto">
                  <SidebarMenu />
                </SheetBody>
              </SheetContent>
            </Sheet>
          )}
        </div>

        <MegaMenu />

        <div className="lg:hidden grow" />

        <div className="flex items-center gap-1.5 sm:gap-2.5 ms-auto">
          <DocsSearchDialog />
          <Button asChild>
            <a href={DASHBOARD_URL}>Dashboard</a>
          </Button>
        </div>
      </div>
    </header>
  );
}
