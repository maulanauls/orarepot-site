'use client';

import { ReactNode, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Bot,
  CreditCard,
  FileText,
  LayoutTemplate,
  MessageSquare,
  Radio,
  Search,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { useT } from '@/components/i18n/locale-provider';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { dashboardPoppins } from '@/lib/fonts/dashboard';
import { cn } from '@/lib/utils';

type SearchCategory = 'all' | 'otp' | 'services' | 'account';

type SearchItem = {
  titleKey: string;
  descKey: string;
  href: string;
  icon: LucideIcon;
  category: Exclude<SearchCategory, 'all'>;
};

const SEARCH_ITEMS: SearchItem[] = [
  {
    titleKey: 'header.searchOtpOverview',
    descKey: 'header.searchOtpOverviewDesc',
    href: '/dashboard/otp',
    icon: ShieldCheck,
    category: 'otp',
  },
  {
    titleKey: 'header.searchOtpSend',
    descKey: 'header.searchOtpSendDesc',
    href: '/dashboard/otp/kirim',
    icon: MessageSquare,
    category: 'otp',
  },
  {
    titleKey: 'header.searchOtpLogs',
    descKey: 'header.searchOtpLogsDesc',
    href: '/dashboard/otp/logs',
    icon: FileText,
    category: 'otp',
  },
  {
    titleKey: 'header.searchOtpTemplates',
    descKey: 'header.searchOtpTemplatesDesc',
    href: '/dashboard/otp/templates',
    icon: LayoutTemplate,
    category: 'otp',
  },
  {
    titleKey: 'header.searchOtpSettings',
    descKey: 'header.searchOtpSettingsDesc',
    href: '/dashboard/otp/settings',
    icon: Settings,
    category: 'otp',
  },
  {
    titleKey: 'header.searchAi',
    descKey: 'header.searchAiDesc',
    href: '/dashboard/ai',
    icon: Bot,
    category: 'services',
  },
  {
    titleKey: 'header.searchBroadcast',
    descKey: 'header.searchBroadcastDesc',
    href: '/dashboard/broadcast',
    icon: Radio,
    category: 'services',
  },
  {
    titleKey: 'header.searchBilling',
    descKey: 'header.searchBillingDesc',
    href: '/dashboard/billing',
    icon: CreditCard,
    category: 'account',
  },
  {
    titleKey: 'header.searchSettings',
    descKey: 'header.searchSettingsDesc',
    href: '/dashboard/settings',
    icon: Settings,
    category: 'account',
  },
];

export function SearchDialog({ trigger }: { trigger: ReactNode }) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SEARCH_ITEMS;
    return SEARCH_ITEMS.filter((item) => {
      const title = t(item.titleKey).toLowerCase();
      const desc = t(item.descKey).toLowerCase();
      return title.includes(q) || desc.includes(q) || item.href.includes(q);
    });
  }, [query, t]);

  const byCategory = (cat: SearchCategory) =>
    cat === 'all' ? filtered : filtered.filter((i) => i.category === cat);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className={cn(
          dashboardPoppins.className,
          'lg:max-w-[560px] lg:top-[15%] lg:translate-y-0 p-0 [&_[data-slot=dialog-close]]:top-5.5 [&_[data-slot=dialog-close]]:end-5.5',
        )}
      >
        <DialogHeader className="px-4 py-1 mb-1">
          <DialogTitle className="sr-only">{t('header.searchTitle')}</DialogTitle>
          <DialogDescription className="sr-only">
            {t('header.searchDesc')}
          </DialogDescription>
          <div className="relative">
            <Search className="absolute top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              type="text"
              name="query"
              value={query}
              className="ps-6 outline-none! ring-0! shadow-none! border-0"
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('header.searchPlaceholder')}
              autoFocus
            />
          </div>
        </DialogHeader>
        <DialogBody className="p-0 pb-4">
          <Tabs defaultValue="all">
            <TabsList className="justify-start mx-5 mb-2.5 w-fit" variant="default">
              <TabsTrigger value="all">{t('header.tabAll')}</TabsTrigger>
              <TabsTrigger value="otp">OTP</TabsTrigger>
              <TabsTrigger value="services">{t('header.tabServices')}</TabsTrigger>
              <TabsTrigger value="account">{t('header.tabAccount')}</TabsTrigger>
            </TabsList>
            <ScrollArea className="h-[420px]">
              {(['all', 'otp', 'services', 'account'] as SearchCategory[]).map(
                (cat) => (
                  <TabsContent key={cat} value={cat} className="mt-0 px-2">
                    <ResultList
                      items={byCategory(cat)}
                      t={t}
                      onNavigate={() => setOpen(false)}
                      emptyLabel={t('header.searchEmpty')}
                    />
                  </TabsContent>
                ),
              )}
            </ScrollArea>
          </Tabs>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function ResultList({
  items,
  t,
  onNavigate,
  emptyLabel,
}: {
  items: SearchItem[];
  t: (key: string) => string;
  onNavigate: () => void;
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-16 px-4 m-0">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 px-2 pb-2">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5',
              'hover:bg-muted/70 transition-colors',
            )}
          >
            <span className="size-9 rounded-lg bg-accent/70 border border-border inline-flex items-center justify-center shrink-0">
              <Icon className="size-4 text-primary" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-mono">
                {t(item.titleKey)}
              </span>
              <span className="block text-xs text-muted-foreground truncate">
                {t(item.descKey)}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
