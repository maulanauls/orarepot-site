'use client';

import { ReactNode, useState } from 'react';
import Link from 'next/link';
import {
  Bot,
  CreditCard,
  Radio,
  ShieldCheck,
  Smartphone,
  type LucideIcon,
} from 'lucide-react';
import { useT } from '@/components/i18n/locale-provider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { dashboardPoppins } from '@/lib/fonts/dashboard';
import { cn } from '@/lib/utils';

type AppItem = {
  id: string;
  titleKey: string;
  descKey: string;
  href: string;
  icon: LucideIcon;
  enabled: boolean;
};

const APPS: AppItem[] = [
  {
    id: 'otp',
    titleKey: 'header.appOtp',
    descKey: 'header.appOtpDesc',
    href: '/dashboard/otp',
    icon: ShieldCheck,
    enabled: true,
  },
  {
    id: 'broadcast',
    titleKey: 'header.appBroadcast',
    descKey: 'header.appBroadcastDesc',
    href: '/dashboard/broadcast',
    icon: Radio,
    enabled: true,
  },
  {
    id: 'ai',
    titleKey: 'header.appAi',
    descKey: 'header.appAiDesc',
    href: '/dashboard/ai',
    icon: Bot,
    enabled: true,
  },
  {
    id: 'whatsapp',
    titleKey: 'header.appWhatsapp',
    descKey: 'header.appWhatsappDesc',
    href: '/dashboard/whatsapp',
    icon: Smartphone,
    enabled: true,
  },
  {
    id: 'billing',
    titleKey: 'header.appBilling',
    descKey: 'header.appBillingDesc',
    href: '/dashboard/billing',
    icon: CreditCard,
    enabled: true,
  },
];

export function AppsDropdownMenu({ trigger }: { trigger: ReactNode }) {
  const t = useT();
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(APPS.map((a) => [a.id, a.enabled])),
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        className={cn(dashboardPoppins.className, 'w-[325px] p-0')}
        side="bottom"
        align="end"
      >
        <div className="flex items-center justify-between gap-2.5 text-xs text-secondary-foreground font-medium px-5 py-3 border-b border-b-border">
          <span>{t('header.appsTitle')}</span>
          <span>{t('header.appsEnabled')}</span>
        </div>
        <div className="flex flex-col scrollable-y-auto max-h-[400px] divide-y divide-border">
          {APPS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className="flex items-center justify-between flex-wrap gap-2 px-5 py-3.5"
              >
                <div className="flex items-center flex-wrap gap-2 min-w-0">
                  <div className="flex items-center justify-center shrink-0 rounded-full bg-accent/60 border border-border size-10">
                    <Icon className="size-5 text-primary" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <Link
                      href={item.href}
                      className="text-sm font-semibold text-mono hover:text-primary"
                    >
                      {t(item.titleKey)}
                    </Link>
                    <span className="text-xs font-medium text-secondary-foreground">
                      {t(item.descKey)}
                    </span>
                  </div>
                </div>
                <Switch
                  size="sm"
                  checked={!!enabled[item.id]}
                  onCheckedChange={(checked) =>
                    setEnabled((prev) => ({ ...prev, [item.id]: checked }))
                  }
                />
              </div>
            );
          })}
        </div>
        <div className="grid p-5 border-t border-t-border">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard">{t('header.appsGo')}</Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
