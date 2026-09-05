'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bot, CreditCard, FileText, Radio, ShieldCheck } from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { useT } from '@/components/i18n/locale-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FEATURES,
  formatIdr,
  remainingBalance,
  remainingUnits,
  TOPUP_PRESETS,
  usageSharePct,
  VA_BANKS,
  type BillingAccount,
  type BillingFeature,
  type Invoice,
  type PayMethod,
} from '@/lib/billing';
import { fetchInvoices, fetchWallet, topupWallet } from '@/lib/orarepot-api';
import { getStoredUser } from '@/lib/session';
import { cn } from '@/lib/utils';

function featureMeta(feature: BillingFeature) {
  if (feature === 'ai') {
    return { icon: Bot, titleKey: 'billing.featAi', unitKey: 'billing.unitAi' };
  }
  if (feature === 'broadcast') {
    return { icon: Radio, titleKey: 'billing.featBroadcast', unitKey: 'billing.unitBroadcast' };
  }
  return { icon: ShieldCheck, titleKey: 'billing.featOtp', unitKey: 'billing.unitOtp' };
}

export function BillingPage() {
  const t = useT();
  const [account, setAccount] = useState<BillingAccount | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [amount, setAmount] = useState(50_000);
  const [custom, setCustom] = useState('');
  const [method, setMethod] = useState<PayMethod>('qris');
  const [bank, setBank] = useState('bca');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchWallet()
      .then(setAccount)
      .catch(() => setAccount(null));
    fetchInvoices()
      .then(setInvoices)
      .catch(() => setInvoices([]));
  }, []);

  const payAmount = custom ? Number(custom.replace(/\D/g, '')) || 0 : amount;
  const left = account ? remainingBalance(account) : 0;

  const canSubmit = useMemo(
    () => payAmount >= 10_000 && (!!method && (method !== 'va' || !!bank)),
    [payAmount, method, bank],
  );

  async function onTopup() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const user = getStoredUser();
      await topupWallet(payAmount, user?.full_name || user?.email || 'Merchant');
      setAccount(await fetchWallet());
      setInvoices(await fetchInvoices());
    } catch {
      /* keep form */
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardShell title={t('billing.title')} subtitle={t('billing.subtitle')}>
      <div className="flex flex-col gap-5 lg:gap-7.5">
        <Card>
          <CardHeader className="py-4">
            <div>
              <CardTitle>{t('billing.walletTitle')}</CardTitle>
              <p className="text-sm text-muted-foreground m-0 mt-1">{t('billing.walletDesc')}</p>
            </div>
            <div className="text-end">
              <p className="text-xs text-muted-foreground m-0">{t('billing.totalLeft')}</p>
              <p className="text-xl font-semibold text-mono m-0">
                {account ? formatIdr(left) : '—'}
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {FEATURES.map((key) => {
              const usage = account?.usage[key];
              const meta = featureMeta(key);
              const Icon = meta.icon;
              const pct = account ? usageSharePct(account, key) : 0;
              return (
                <div key={key} className="rounded-lg border border-border px-4 py-3.5">
                  <div className="flex items-center gap-2.5 mb-3">
                    <span className="size-9 rounded-lg bg-primary/10 text-primary inline-flex items-center justify-center shrink-0">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold m-0">{t(meta.titleKey)}</p>
                      <p className="text-xs text-muted-foreground m-0">
                        {usage
                          ? t('billing.unitCost', {
                              price: formatIdr(usage.unitCost),
                              unit: t(meta.unitKey),
                            })
                          : '—'}
                      </p>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        pct >= 40 ? 'bg-amber-500' : 'bg-primary',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground m-0 mt-2">
                    {account && usage
                      ? t('billing.usedOf', {
                          used: formatIdr(usage.used),
                          units: remainingUnits(account, key),
                          unit: t(meta.unitKey),
                        })
                      : t('common.loading')}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="grid gap-5 lg:grid-cols-12 lg:gap-7.5 items-start">
          <Card className="lg:col-span-7">
            <CardHeader className="py-4">
              <div>
                <CardTitle>{t('billing.topupTitle')}</CardTitle>
                <p className="text-sm text-muted-foreground m-0 mt-1">{t('billing.topupDesc')}</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>{t('billing.amount')}</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {TOPUP_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setAmount(preset);
                        setCustom('');
                      }}
                      className={cn(
                        'rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                        !custom && amount === preset
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-card hover:bg-muted',
                      )}
                    >
                      {formatIdr(preset)}
                    </button>
                  ))}
                </div>
                <Input
                  inputMode="numeric"
                  placeholder={t('billing.customAmount')}
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('billing.payMethod')}</Label>
                <div className="grid sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMethod('qris')}
                    className={cn(
                      'rounded-lg border px-4 py-3 text-start transition-colors',
                      method === 'qris'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/60',
                    )}
                  >
                    <p className="text-sm font-semibold m-0">{t('billing.qris')}</p>
                    <p className="text-xs text-muted-foreground m-0">{t('billing.qrisDesc')}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMethod('va')}
                    className={cn(
                      'rounded-lg border px-4 py-3 text-start transition-colors',
                      method === 'va'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/60',
                    )}
                  >
                    <p className="text-sm font-semibold m-0">{t('billing.va')}</p>
                    <p className="text-xs text-muted-foreground m-0">{t('billing.vaDesc')}</p>
                  </button>
                </div>
                {method === 'va' ? (
                  <Select value={bank} onValueChange={setBank}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('billing.chooseBank')} />
                    </SelectTrigger>
                    <SelectContent>
                      {VA_BANKS.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
              </div>
            </CardContent>
            <CardFooter className="justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground m-0">{t('billing.youPay')}</p>
                <p className="text-lg font-semibold text-mono m-0">{formatIdr(payAmount)}</p>
              </div>
              <Button onClick={onTopup} disabled={!canSubmit || submitting}>
                <CreditCard />
                {submitting ? t('billing.redirecting') : t('billing.continuePay')}
              </Button>
            </CardFooter>
          </Card>

          <Card className="lg:col-span-5">
            <CardHeader className="py-4">
              <div>
                <CardTitle>{t('billing.summaryTitle')}</CardTitle>
                <p className="text-sm text-muted-foreground m-0 mt-1">{t('billing.summaryDesc')}</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row
                label={t('billing.currentBalance')}
                value={account ? formatIdr(left) : '—'}
              />
              <Row label={t('billing.topupAmount')} value={formatIdr(payAmount)} />
              <Row
                label={t('billing.payMethod')}
                value={
                  method === 'qris'
                    ? t('billing.qris')
                    : `${t('billing.va')} · ${VA_BANKS.find((b) => b.id === bank)?.label ?? ''}`
                }
              />
              {account ? (
                <p className="text-xs text-muted-foreground m-0 pt-2">
                  {t('billing.afterTopup', {
                    balance: formatIdr(left + payAmount),
                  })}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="py-4">
            <div>
              <CardTitle className="uppercase font-bold tracking-wide">
                {t('billing.invoicesTitle')}
              </CardTitle>
              <p className="text-sm text-muted-foreground m-0 mt-1">{t('billing.invoicesDesc')}</p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-y border-border bg-muted/40">
                  <tr className="text-muted-foreground text-left">
                    <th className="px-5 py-3 font-medium">{t('billing.colInvoice')}</th>
                    <th className="px-5 py-3 font-medium">{t('billing.colDate')}</th>
                    <th className="px-5 py-3 font-medium">{t('billing.colStatus')}</th>
                    <th className="px-5 py-3 font-medium text-end">{t('billing.colAmount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-border last:border-0">
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-2">
                          <FileText className="size-4 text-muted-foreground" />
                          {inv.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {new Date(inv.date).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-5 py-3">
                        <Badge
                          variant={inv.status === 'paid' ? 'success' : 'warning'}
                          appearance="light"
                          size="sm"
                        >
                          {inv.status === 'paid' ? t('billing.paid') : t('billing.pending')}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-end font-medium">{formatIdr(inv.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-mono text-end">{value}</span>
    </div>
  );
}
