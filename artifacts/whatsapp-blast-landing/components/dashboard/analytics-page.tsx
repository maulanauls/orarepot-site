'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { LayoutTemplate, Percent, Send, ShieldX, Wallet } from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { OtpAreaChart } from '@/components/dashboard/otp-area-chart';
import { useT } from '@/components/i18n/locale-provider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatIdr, remainingBalance, type BillingAccount } from '@/lib/billing';
import {
  fetchOtpSends,
  fetchTemplates,
  fetchWallet,
  type OtpSendRow,
} from '@/lib/orarepot-api';
import { OTP_COST_PER_MESSAGE, type OtpTemplate } from '@/lib/otp-templates';
import {
  chartForRange,
  enrichTemplates,
  failedCount,
  otpUnitsLeft,
  purposeBreakdown,
  rowsInRange,
  sentCount,
} from '@/lib/otp-dashboard';
import { cn } from '@/lib/utils';

function formatId(n: number) {
  return n.toLocaleString('id-ID');
}

export function AnalyticsPage() {
  const t = useT();
  const [range, setRange] = useState('7d');
  const [sends, setSends] = useState<OtpSendRow[]>([]);
  const [templates, setTemplates] = useState<OtpTemplate[]>([]);
  const [wallet, setWallet] = useState<BillingAccount | null>(null);

  useEffect(() => {
    Promise.all([
      fetchOtpSends().catch(() => [] as OtpSendRow[]),
      fetchTemplates().catch(() => [] as OtpTemplate[]),
      fetchWallet().catch(() => null),
    ]).then(([rows, tpls, account]) => {
      setSends(rows);
      setTemplates(enrichTemplates(tpls, rows));
      setWallet(account);
    });
  }, []);

  const scoped = useMemo(() => rowsInRange(sends, range), [sends, range]);
  const sent = sentCount(scoped);
  const failed = failedCount(scoped);
  const total = scoped.length;
  const rate = total === 0 ? '0%' : `${((sent / total) * 100).toFixed(1)}%`;
  const left = wallet ? remainingBalance(wallet) : 0;
  const units = otpUnitsLeft(left);
  const purposes = useMemo(
    () =>
      purposeBreakdown(
        scoped.filter((row) => row.status === 'success'),
        templates,
      ),
    [scoped, templates],
  );
  const chart = useMemo(() => chartForRange(sends, range), [sends, range]);
  const ranked = useMemo(
    () => [...templates].sort((a, b) => b.messagesSent - a.messagesSent),
    [templates],
  );

  return (
    <DashboardShell title={t('menu.analytics')} subtitle={t('page.analytics')}>
      <div className="grid gap-5 lg:gap-7.5">
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5">
          <StatCard icon={Send} label={t('otp.chartTitle')} value={formatId(sent)} />
          <StatCard icon={ShieldX} label={t('otp.logFailed')} value={formatId(failed)} />
          <StatCard icon={Percent} label="Success Rate" value={rate} />
          <StatCard icon={Wallet} label={t('otp.unitsLeft')} value={formatId(units)} />
        </div>

        <div className="grid lg:grid-cols-3 gap-5 lg:gap-7.5 items-stretch">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{t('otp.chartTitle')}</CardTitle>
              <Select value={range} onValueChange={setRange}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="w-28">
                  <SelectItem value="7d">{t('otp.range7')}</SelectItem>
                  <SelectItem value="30d">{t('otp.range30')}</SelectItem>
                  <SelectItem value="12m">{t('otp.range12m')}</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="px-3 py-1">
              <OtpAreaChart
                labels={chart.labels}
                values={chart.delivered}
                gradientId="analyticsOtpFill"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('dash.balance')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-2xl font-semibold text-mono m-0">{formatIdr(left)}</p>
              <p className="text-sm text-muted-foreground m-0">
                {t('billing.featOtp')}: {formatIdr(wallet?.usage.otp.used ?? 0)}
              </p>
              <p className="text-sm text-muted-foreground m-0">
                {t('otp.costPerMsg')}: {formatIdr(OTP_COST_PER_MESSAGE)}
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/billing">{t('menu.billing')}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-5 lg:gap-7.5">
          <Card>
            <CardHeader>
              <CardTitle>Highlights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {purposes.length === 0 ? (
                <p className="text-sm text-muted-foreground m-0">{t('otp.noSends')}</p>
              ) : (
                purposes.map((p) => (
                  <div key={p.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5">
                        <span className={cn('size-1.5 rounded-full', p.color)} />
                        {p.label}
                      </span>
                      <span className="font-medium text-mono">{formatId(p.value)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', p.color)}
                        style={{ width: `${Math.max(p.pct, 2)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{t('menu.otpTemplates')}</CardTitle>
              <Button mode="link" underlined="dashed" asChild>
                <Link href="/dashboard/otp/templates">{t('otp.fullPicture')}</Link>
              </Button>
            </CardHeader>
            <CardContent className="grid gap-3">
              {ranked.length === 0 ? (
                <p className="text-sm text-muted-foreground m-0">
                  {t('otp.sendTemplateEmpty')}
                </p>
              ) : (
                ranked.slice(0, 6).map((tpl) => (
                  <Link
                    key={tpl.id}
                    href={`/dashboard/otp/templates/${tpl.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <LayoutTemplate className="size-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="m-0 text-sm font-medium text-mono truncate">
                          {tpl.name}
                        </p>
                        <p className="m-0 text-xs text-muted-foreground">
                          {tpl.statusLabel}
                        </p>
                      </div>
                    </div>
                    <div className="text-end">
                      <p className="m-0 text-sm font-semibold text-mono">
                        {formatId(tpl.messagesSent)}
                      </p>
                      <p className="m-0 text-xs text-muted-foreground">
                        {t('otp.colSent')}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Send;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <span className="size-10 rounded-lg bg-primary/10 inline-flex items-center justify-center">
          <Icon className="size-5 text-primary" />
        </span>
        <div>
          <p className="m-0 text-2xl font-semibold text-mono">{value}</p>
          <p className="m-0 text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
