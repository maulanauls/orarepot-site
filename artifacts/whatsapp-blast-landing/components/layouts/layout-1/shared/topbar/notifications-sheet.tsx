'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { useT } from '@/components/i18n/locale-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { dashboardPoppins } from '@/lib/fonts/dashboard';
import { cn } from '@/lib/utils';

type NotifKind = 'system' | 'billing';

type Notif = {
  id: string;
  kind: NotifKind;
  titleKey: string;
  bodyKey: string;
  timeKey: string;
  href?: string;
  tone: 'info' | 'success' | 'warning';
};

const NOTIFS: Notif[] = [
  {
    id: '1',
    kind: 'system',
    titleKey: 'header.n1Title',
    bodyKey: 'header.n1Body',
    timeKey: 'header.n1Time',
    href: '/dashboard/otp/settings',
    tone: 'info',
  },
  {
    id: '2',
    kind: 'billing',
    titleKey: 'header.n2Title',
    bodyKey: 'header.n2Body',
    timeKey: 'header.n2Time',
    href: '/dashboard/billing',
    tone: 'warning',
  },
  {
    id: '3',
    kind: 'system',
    titleKey: 'header.n3Title',
    bodyKey: 'header.n3Body',
    timeKey: 'header.n3Time',
    href: '/dashboard/otp/templates',
    tone: 'success',
  },
  {
    id: '4',
    kind: 'billing',
    titleKey: 'header.n4Title',
    bodyKey: 'header.n4Body',
    timeKey: 'header.n4Time',
    href: '/dashboard/billing',
    tone: 'success',
  },
  {
    id: '5',
    kind: 'system',
    titleKey: 'header.n5Title',
    bodyKey: 'header.n5Body',
    timeKey: 'header.n5Time',
    href: '/dashboard/otp',
    tone: 'info',
  },
];

function NotifIcon({ tone }: { tone: Notif['tone'] }) {
  if (tone === 'success') {
    return <CheckCircle2 className="size-4 text-green-600" />;
  }
  if (tone === 'warning') {
    return <AlertTriangle className="size-4 text-amber-600" />;
  }
  return <Info className="size-4 text-primary" />;
}

export function NotificationsSheet({ trigger }: { trigger: ReactNode }) {
  const t = useT();

  const renderList = (items: Notif[]) => {
    if (items.length === 0) {
      return (
        <p className="text-sm text-muted-foreground text-center py-16 px-6 m-0">
          {t('header.notifEmpty')}
        </p>
      );
    }
    return (
      <div className="flex flex-col">
        {items.map((n, i) => (
          <div key={n.id}>
            <Link
              href={n.href ?? '#'}
              className="flex gap-3 px-5 py-4 hover:bg-muted/50 transition-colors"
            >
              <span
                className={cn(
                  'size-9 rounded-full border border-border bg-accent/50 inline-flex items-center justify-center shrink-0',
                )}
              >
                {n.kind === 'billing' ? (
                  <CreditCard className="size-4 text-primary" />
                ) : n.id === '3' ? (
                  <ShieldCheck className="size-4 text-green-600" />
                ) : (
                  <NotifIcon tone={n.tone} />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-mono">
                    {t(n.titleKey)}
                  </span>
                  <Badge
                    size="sm"
                    variant={n.kind === 'billing' ? 'warning' : 'info'}
                    appearance="light"
                    className="shrink-0"
                  >
                    {n.kind === 'billing'
                      ? t('header.tabBilling')
                      : t('header.tabSystem')}
                  </Badge>
                </span>
                <span className="block text-xs text-muted-foreground mt-1 leading-relaxed">
                  {t(n.bodyKey)}
                </span>
                <span className="block text-[11px] text-muted-foreground mt-1.5">
                  {t(n.timeKey)}
                </span>
              </span>
            </Link>
            {i < items.length - 1 ? (
              <div className="border-b border-border mx-5" />
            ) : null}
          </div>
        ))}
      </div>
    );
  };

  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        className={cn(
          dashboardPoppins.className,
          'gap-0 sm:w-[420px] inset-5 start-auto h-auto rounded-lg p-0 sm:max-w-none [&_[data-slot=sheet-close]]:top-4.5 [&_[data-slot=sheet-close]]:end-5',
        )}
      >
        <SheetHeader className="mb-0">
          <SheetTitle className="p-3">{t('header.notifTitle')}</SheetTitle>
        </SheetHeader>
        <SheetBody className="grow p-0">
          <ScrollArea className="h-[calc(100vh-10.5rem)]">
            <Tabs defaultValue="all" className="w-full">
              <TabsList variant="default" className="mx-5 mb-3 w-fit">
                <TabsTrigger value="all">{t('header.tabAll')}</TabsTrigger>
                <TabsTrigger value="system">{t('header.tabSystem')}</TabsTrigger>
                <TabsTrigger value="billing">{t('header.tabBilling')}</TabsTrigger>
              </TabsList>
              <TabsContent value="all" className="mt-0">
                {renderList(NOTIFS)}
              </TabsContent>
              <TabsContent value="system" className="mt-0">
                {renderList(NOTIFS.filter((n) => n.kind === 'system'))}
              </TabsContent>
              <TabsContent value="billing" className="mt-0">
                {renderList(NOTIFS.filter((n) => n.kind === 'billing'))}
              </TabsContent>
            </Tabs>
          </ScrollArea>
        </SheetBody>
        <SheetFooter className="border-t border-border p-3 grid">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/settings">{t('header.notifSettings')}</Link>
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
