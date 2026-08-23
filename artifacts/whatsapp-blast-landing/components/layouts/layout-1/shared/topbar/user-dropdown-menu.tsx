'use client';

import { ReactNode, useMemo } from 'react';
import { CreditCard, Globe, Settings } from 'lucide-react';
import Link from 'next/link';
import { useLocale } from '@/components/i18n/locale-provider';
import { toAbsoluteUrl } from '@/lib/helpers';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { dashboardPoppins } from '@/lib/fonts/dashboard';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const I18N_LANGUAGES: {
  label: string;
  code: Locale;
  flag: string;
}[] = [
  {
    label: 'Indonesia',
    code: 'id',
    flag: toAbsoluteUrl('/media/flags/indonesia.svg'),
  },
  {
    label: 'English',
    code: 'en',
    flag: toAbsoluteUrl('/media/flags/united-states.svg'),
  },
];

export function UserDropdownMenu({ trigger }: { trigger: ReactNode }) {
  const { locale, setLocale, t } = useLocale();

  const currentLanguage = useMemo(
    () => I18N_LANGUAGES.find((l) => l.code === locale) ?? I18N_LANGUAGES[0],
    [locale],
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        className={cn(dashboardPoppins.className, 'w-64')}
        side="bottom"
        align="end"
      >
        <div className="flex items-center gap-2.5 p-3">
          <img
            className="size-9 rounded-full border-2 border-green-500"
            src={toAbsoluteUrl('/media/avatars/300-2.png')}
            alt=""
          />
          <div className="flex flex-col min-w-0">
            <span className="text-sm text-mono font-semibold truncate">
              {t('header.merchantName')}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              merchant@orarepot.com
            </span>
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings" className="flex items-center gap-2">
            <Settings />
            {t('menu.settings')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/billing" className="flex items-center gap-2">
            <CreditCard />
            {t('menu.billing')}
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="flex items-center gap-2 [&_[data-slot=dropdown-menu-sub-trigger-indicator]]:hidden hover:[&_[data-slot=badge]]:border-input data-[state=open]:[&_[data-slot=badge]]:border-input">
            <Globe />
            <span className="flex items-center justify-between gap-2 grow relative">
              {t('lang.label')}
              <Badge
                variant="outline"
                className="absolute end-0 top-1/2 -translate-y-1/2"
              >
                {currentLanguage.label}
                <img
                  src={currentLanguage.flag}
                  className="w-3.5 h-3.5 rounded-full"
                  alt=""
                />
              </Badge>
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-48">
            <DropdownMenuRadioGroup
              value={locale}
              onValueChange={(code) => {
                if (isLocale(code)) setLocale(code);
              }}
            >
              {I18N_LANGUAGES.map((item) => (
                <DropdownMenuRadioItem
                  key={item.code}
                  value={item.code}
                  className="flex items-center gap-2"
                >
                  <img
                    src={item.flag}
                    className="w-4 h-4 rounded-full"
                    alt=""
                  />
                  <span>{item.label}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <div className="p-2">
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href="/sign-in">{t('header.logout')}</Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
