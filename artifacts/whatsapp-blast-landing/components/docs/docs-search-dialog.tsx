'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { DOCS_SEARCH } from '@/config/docs.config';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { dashboardPoppins } from '@/lib/fonts/dashboard';

export function DocsSearchDialog() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DOCS_SEARCH;
    return DOCS_SEARCH.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.desc.toLowerCase().includes(q) ||
        item.href.includes(q),
    );
  }, [query]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="hidden sm:inline-flex h-9 min-w-[200px] justify-start gap-2 text-muted-foreground"
        >
          <Search className="size-4" />
          Search...
          <kbd className="ms-auto rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium">
            ⌘K
          </kbd>
        </Button>
      </DialogTrigger>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          mode="icon"
          shape="circle"
          className="sm:hidden size-9 hover:bg-primary/10 hover:[&_svg]:text-primary"
        >
          <Search className="size-4.5!" />
        </Button>
      </DialogTrigger>
      <DialogContent
        className={cn(
          dashboardPoppins.className,
          'lg:max-w-[520px] lg:top-[15%] lg:translate-y-0 p-0 [&_[data-slot=dialog-close]]:top-5.5 [&_[data-slot=dialog-close]]:end-5.5',
        )}
      >
        <DialogHeader className="px-4 py-1 mb-1">
          <DialogTitle className="sr-only">Search docs</DialogTitle>
          <DialogDescription className="sr-only">
            Search Ora Repot OTP documentation
          </DialogDescription>
          <div className="relative">
            <Search className="absolute top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              type="text"
              name="query"
              value={query}
              className="ps-6 outline-none! ring-0! shadow-none! border-0"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search documentation…"
              autoFocus
            />
          </div>
        </DialogHeader>
        <DialogBody className="p-0 pb-4">
          <ScrollArea className="h-[320px]">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-16 px-4 m-0">
                No matching pages
              </p>
            ) : (
              <div className="flex flex-col gap-0.5 px-4 pb-2">
                {filtered.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-2.5 hover:bg-muted/70 transition-colors"
                  >
                    <span className="block text-sm font-medium text-mono">
                      {item.title}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {item.desc}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
