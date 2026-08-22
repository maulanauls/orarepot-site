'use client';

import { DashboardShell } from '@/components/dashboard/shell';
import { useT } from '@/components/i18n/locale-provider';
import { Card, CardContent } from '@/components/ui/card';
import { toAbsoluteUrl } from '@/lib/helpers';

/** Metronic-style empty state — full width card */
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
  const resolvedTitle = titleKey ? t(titleKey) : title ?? '';
  const resolvedSubtitle = subtitleKey
    ? t(subtitleKey)
    : subtitle;

  return (
    <DashboardShell title={resolvedTitle} subtitle={resolvedSubtitle}>
      <Card className="w-full">
        <CardContent className="flex flex-col items-center justify-center gap-5 py-20 md:py-28 px-6 text-center min-h-[420px] md:min-h-[520px]">
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
          <p className="text-sm md:text-base text-muted-foreground m-0 max-w-md">
            {t('empty.placeholder')}
          </p>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
