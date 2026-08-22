'use client';

import { ReactNode, useMemo } from 'react';
import {
  BetweenHorizontalStart,
  Coffee,
  CreditCard,
  FileText,
  Globe,
  IdCard,
  Moon,
  Settings,
  Shield,
  SquareCode,
  UserCircle,
  Users,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import Link from 'next/link';
import { useLocale } from '@/components/i18n/locale-provider';
import { toAbsoluteUrl } from '@/lib/helpers';
import { isLocale, type Locale } from '@/lib/i18n/config';
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
import { Switch } from '@/components/ui/switch';

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
  const { theme, setTheme } = useTheme();

  const currentLanguage = useMemo(
    () => I18N_LANGUAGES.find((l) => l.code === locale) ?? I18N_LANGUAGES[0],
    [locale],
  );

  const handleThemeToggle = (checked: boolean) => {
    setTheme(checked ? 'dark' : 'light');
  };

  const handleLanguageChange = (code: string) => {
    if (isLocale(code)) setLocale(code);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        className={cn(dashboardPoppins.className, 'w-64')}
        side="bottom"
        align="end"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2">
            <img
              className="size-9 rounded-full border-2 border-green-500"
              src={toAbsoluteUrl('/media/avatars/300-2.png')}
              alt="User avatar"
            />
            <div className="flex flex-col">
              <Link
                href="#"
                className="text-sm text-mono hover:text-primary font-semibold"
              >
                Sean
              </Link>
              <a
                href={`mailto:sean@kt.com`}
                className="text-xs text-muted-foreground hover:text-primary"
              >
                sean@kt.com
              </a>
            </div>
          </div>
          <Badge variant="primary" appearance="light" size="sm">
            Pro
          </Badge>
        </div>

        <DropdownMenuSeparator />

        {/* Menu Items */}
        <DropdownMenuItem asChild>
          <Link href="#" className="flex items-center gap-2">
            <IdCard />
            Public Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="#" className="flex items-center gap-2">
            <UserCircle />
            My Profile
          </Link>
        </DropdownMenuItem>

        {/* My Account Submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="flex items-center gap-2">
            <Settings />
            My Account
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-48">
            <DropdownMenuItem asChild>
              <Link href="#" className="flex items-center gap-2">
                <Coffee />
                Get Started
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="#" className="flex items-center gap-2">
                <FileText />
                My Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/billing" className="flex items-center gap-2">
                <CreditCard />
                Billing
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="#" className="flex items-center gap-2">
                <Shield />
                Security
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="#" className="flex items-center gap-2">
                <Users />
                Members & Roles
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="#" className="flex items-center gap-2">
                <BetweenHorizontalStart />
                Integrations
              </Link>
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuItem asChild>
          <Link
            href="https://devs.keenthemes.com"
            className="flex items-center gap-2"
            target="_blank"
            rel="noreferrer"
          >
            <SquareCode />
            Dev Forum
          </Link>
        </DropdownMenuItem>

        {/* Language Submenu — wired to app i18n */}
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
                  alt={currentLanguage.label}
                />
              </Badge>
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-48">
            <DropdownMenuRadioGroup
              value={locale}
              onValueChange={handleLanguageChange}
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
                    alt={item.label}
                  />
                  <span>{item.label}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        {/* Footer */}
        <DropdownMenuItem
          className="flex items-center gap-2"
          onSelect={(event) => event.preventDefault()}
        >
          <Moon />
          <div className="flex items-center gap-2 justify-between grow">
            Dark Mode
            <Switch
              size="sm"
              checked={theme === 'dark'}
              onCheckedChange={handleThemeToggle}
            />
          </div>
        </DropdownMenuItem>
        <div className="p-2 mt-1">
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href="/sign-in">Logout</Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
