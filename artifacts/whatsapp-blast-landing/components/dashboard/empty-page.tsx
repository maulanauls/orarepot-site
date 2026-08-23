'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { useT } from '@/components/i18n/locale-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toAbsoluteUrl } from '@/lib/helpers';
import { MENU_I18N, PAGE_SUBTITLE } from '@/lib/i18n/menu-keys';

/** Metronic-style empty / WIP state — full width card */
export function EmptyPage({
  title,
  subtitle,
  titleKey,
  subtitleKey,
}: {
  title?: string;
  subtitle?: string;
  titleKey?: string;
  subtitleKey?: string;
}) {
  const t = useT();
  const pathname = usePathname();
  const resolvedTitle = titleKey
    ? t(titleKey)
    : title ?? (MENU_I18N[pathname] ? t(MENU_I18N[pathname]) : '');
  const resolvedSubtitle = subtitleKey
    ? t(subtitleKey)
    : subtitle ?? (PAGE_SUBTITLE[pathname] ? t(PAGE_SUBTITLE[pathname]) : undefined);

  return (
    <DashboardShell title={resolvedTitle} subtitle={resolvedSubtitle}>
      <Card className="w-full">
        <CardContent className="flex flex-col items-center justify-center gap-5 py-16 md:py-24 px-6 text-center min-h-[420px] md:min-h-[520px]">
          <Badge variant="warning" appearance="light" size="sm">
            {t('empty.kicker')}
          </Badge>
          <img
            src={toAbsoluteUrl('/media/illustrations/9.svg')}
            alt=""
            className="w-[200px] md:w-[260px] h-auto opacity-90 dark:hidden"
          />
          <img
            src={toAbsoluteUrl('/media/illustrations/9.svg')}
            alt=""
            className="w-[200px] md:w-[260px] h-auto opacity-90 hidden dark:block"
          />
          <div className="max-w-md space-y-2">
            <h2 className="text-lg md:text-xl font-semibold text-mono m-0">
              {t('empty.title')}
            </h2>
            <p className="text-sm md:text-base text-foreground m-0">
              {t('empty.body')}
            </p>
            <p className="text-xs md:text-sm text-muted-foreground m-0">
              {t('empty.hint')}
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard">
              <ArrowLeft /> {t('empty.back')}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
