'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function Article({
  section,
  title,
  lead,
  children,
}: {
  section: string;
  title: string;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <div className="container-fluid">
      <div className="flex items-start justify-between gap-4 pb-7.5">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground m-0">
            {section}
          </p>
          <h1 className="mt-2 text-xl font-medium leading-none text-mono">
            {title}
          </h1>
          <p className="mt-2 text-sm text-secondary-foreground m-0 max-w-[640px]">
            {lead}
          </p>
        </div>
        <CopyPage />
      </div>

      <div className="flex items-start gap-7.5 pb-10">
        <article className="docs-article min-w-0 grow max-w-[760px]">
          {children}
        </article>
        <aside className="hidden xl:block w-[200px] shrink-0 sticky top-24">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2.5">
            On this page
          </p>
          <Toc />
        </aside>
      </div>
    </div>
  );
}

function CopyPage() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text =
      document.querySelector('.docs-article')?.textContent ?? window.location.href;
    await navigator.clipboard.writeText(text.trim());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <Button variant="outline" size="sm" onClick={copy}>
      {copied ? <Check /> : <Copy />}
      Copy page
    </Button>
  );
}

function Toc() {
  const pathname = usePathname();
  const [heads, setHeads] = useState<{ id: string; text: string }[]>([]);

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll('.docs-article h2[id]'));
    setHeads(
      nodes.map((node) => ({
        id: node.id,
        text: node.textContent ?? '',
      })),
    );
  }, [pathname]);

  if (heads.length === 0) return null;

  return (
    <nav className="grid gap-1">
      {heads.map((head) => (
        <a
          key={head.id}
          href={`#${head.id}`}
          className="text-sm text-muted-foreground hover:text-primary"
        >
          {head.text}
        </a>
      ))}
    </nav>
  );
}

export function Cards({
  items,
}: {
  items: { title: string; body: string; href?: string }[];
}) {
  return (
    <div className="my-5 grid gap-3 sm:grid-cols-2">
      {items.map((item) => {
        const inner = (
          <>
            <CardHeader className="min-h-auto py-4">
              <CardTitle className="text-sm">{item.title}</CardTitle>
              <CardDescription>{item.body}</CardDescription>
            </CardHeader>
            {item.href ? (
              <CardContent className="pt-0 pb-4">
                <span className="text-sm font-medium text-primary">Read →</span>
              </CardContent>
            ) : null}
          </>
        );

        if (item.href) {
          return (
            <Link key={item.title} href={item.href} className="block h-full">
              <Card className="h-full transition-colors hover:border-primary/40">
                {inner}
              </Card>
            </Link>
          );
        }

        return <Card key={item.title}>{inner}</Card>;
      })}
    </div>
  );
}
