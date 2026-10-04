'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronDown, Store } from 'lucide-react';
import { useT } from '@/components/i18n/locale-provider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { dashboardPoppins } from '@/lib/fonts/dashboard';
import {
  activateMerchant,
  fetchAllowedMerchants,
  type AllowedMerchant,
} from '@/lib/orarepot-api';
import { getMerchantId } from '@/lib/session';
import { cn } from '@/lib/utils';

function roleLabel(role: string, t: (key: string) => string) {
  if (role === 'owner') return t('members.roleOwner');
  if (role === 'admin') return t('members.roleAdmin');
  return t('members.roleAgent');
}

export function MerchantSwitcher() {
  const t = useT();
  const [rows, setRows] = useState<AllowedMerchant[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setActiveId(getMerchantId());
    fetchAllowedMerchants()
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  if (rows.length === 0) return null;

  const active = rows.find((row) => row.merchantId === activeId) ?? rows[0];

  function choose(merchantId: string) {
    if (merchantId === active?.merchantId && merchantId === getMerchantId()) return;
    activateMerchant(merchantId);
    window.location.assign('/dashboard');
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="max-w-[11rem] sm:max-w-[16rem] gap-1.5"
        >
          <Store className="size-4 shrink-0" />
          <span className="truncate">{active.displayName}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className={cn(dashboardPoppins.className, 'w-72')}
        align="end"
      >
        <DropdownMenuLabel>{t('header.merchants')}</DropdownMenuLabel>
        {rows.map((row) => {
          const selected = row.merchantId === active.merchantId;
          return (
            <DropdownMenuItem
              key={row.merchantId}
              className="flex items-center gap-2"
              onSelect={() => choose(row.merchantId)}
            >
              <Store className="size-4 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{row.displayName}</span>
                <span className="block text-xs text-muted-foreground">
                  {roleLabel(row.role, t)}
                </span>
              </span>
              {selected ? <Check className="size-4 shrink-0" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
