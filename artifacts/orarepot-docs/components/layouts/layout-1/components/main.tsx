'use client';

import { useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useLayout } from './context';
import { Footer } from './footer';
import { Header } from './header';
import { Sidebar } from './sidebar';

export function Main({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const { sidebarCollapse } = useLayout();

  // Keep body overflow lock in sync with Metronic starter; layout chrome uses a root wrapper below.
  useEffect(() => {
    const bodyClass = document.body.classList;
    bodyClass.add('demo1');

    const timer = setTimeout(() => {
      bodyClass.add('layout-initialized');
    }, 1000);

    return () => {
      bodyClass.remove('demo1');
      bodyClass.remove('sidebar-fixed');
      bodyClass.remove('sidebar-collapse');
      bodyClass.remove('header-fixed');
      bodyClass.remove('layout-initialized');
      clearTimeout(timer);
    };
  }, []);

  return (
    <div
      className={cn(
        'demo1 sidebar-fixed header-fixed flex grow flex-col w-full min-h-full',
        sidebarCollapse && 'sidebar-collapse',
        'layout-initialized',
      )}
    >
      {!isMobile && <Sidebar />}

      <div className="wrapper flex grow flex-col">
        <Header />

        <main className="grow pt-5" role="content">
          {children}
        </main>

        <Footer />
      </div>
    </div>
  );
}
