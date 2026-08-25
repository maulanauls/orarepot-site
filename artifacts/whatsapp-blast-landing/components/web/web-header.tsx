'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { DocsSearchDialog } from '@/components/docs/docs-search-dialog';

const NAV: { href: string; label: string; external?: boolean }[] = [
  { href: '/docs', label: 'Docs' },
  { href: 'https://api.orarepot.com', label: 'API', external: true },
  { href: '/harga/di/orarepot', label: 'Pricing' },
];

function isActive(pathname: string, href: string) {
  if (href.startsWith('http')) return false;
  if (href === '/docs') return pathname === '/docs' || pathname.startsWith('/docs/');
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Metronic SaaS landing header (metronic-tailwind-nextjs-landings/saas)
 * with Ora Repot branding.
 */
export function WebHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 50);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-40 transition-all duration-300',
        scrolled
          ? 'bg-background/60 backdrop-blur-sm shadow-xs'
          : 'bg-background/80 backdrop-blur-sm',
      )}
    >
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center shrink-0">
          <img
            src="/logo-orarepot.png"
            alt="Ora Repot"
            className="h-8 w-auto max-w-[168px] object-contain object-left"
          />
        </Link>

        <div className="flex items-center gap-2.5">
          <nav className="hidden md:flex items-center space-x-8">
            {NAV.map((item) => {
              const className = cn(
                'text-sm transition-colors relative group',
                isActive(pathname, item.href)
                  ? 'text-primary'
                  : 'text-accent-foreground hover:text-primary',
              );
              const underline = (
                <span
                  className={cn(
                    'absolute -bottom-1 left-0 h-0.5 bg-primary transition-all',
                    isActive(pathname, item.href) ? 'w-full' : 'w-0 group-hover:w-full',
                  )}
                />
              );
              if (item.external) {
                return (
                  <a key={item.href} href={item.href} className={className}>
                    {item.label}
                    {underline}
                  </a>
                );
              }
              return (
                <Link key={item.href} href={item.href} className={className}>
                  {item.label}
                  {underline}
                </Link>
              );
            })}
            <DocsSearchDialog />
            <Button asChild>
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          </nav>

          <div className="md:hidden flex items-center gap-1">
            <DocsSearchDialog />
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" mode="icon">
                  <Menu className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px]">
                <SheetHeader>
                  <SheetTitle className="sr-only">Menu</SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-1 mt-4">
                  {NAV.map((item) => (
                    <Button
                      key={item.href}
                      variant="ghost"
                      className={cn(
                        'w-full justify-start',
                        isActive(pathname, item.href) && 'text-primary font-medium',
                      )}
                      asChild
                    >
                      {item.external ? (
                        <a href={item.href}>{item.label}</a>
                      ) : (
                        <Link href={item.href}>{item.label}</Link>
                      )}
                    </Button>
                  ))}
                  <Button asChild className="mt-3">
                    <Link href="/dashboard">Dashboard</Link>
                  </Button>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
