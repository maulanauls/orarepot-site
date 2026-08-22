'use client';

import { cn } from '@/lib/utils';
import { LOCALES, type Locale } from '@/lib/i18n/config';
import { useLocale } from '@/components/i18n/locale-provider';

export function LanguageSwitcher({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { locale, setLocale, t } = useLocale();

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-md border border-border bg-card p-0.5',
        className,
      )}
      role="group"
      aria-label={t('lang.label')}
    >
      {LOCALES.map((code: Locale) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          className={cn(
            'rounded px-2 py-1 text-xs font-medium transition-colors',
            compact ? 'min-w-8' : 'min-w-9',
            locale === code
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
          aria-pressed={locale === code}
        >
          {t(`lang.${code}`)}
        </button>
      ))}
    </div>
  );
}
