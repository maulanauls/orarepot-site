'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CreditCard,
  LayoutTemplate,
  Percent,
  Send,
  ShieldX,
  Users,
  Wallet,
} from 'lucide-react';
import { toAbsoluteUrl } from '@/lib/helpers';
import { DashboardShell } from '@/components/dashboard/shell';
import { OtpAreaChart } from '@/components/dashboard/otp-area-chart';
import { useT } from '@/components/i18n/locale-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatIdr, remainingBalance, type BillingAccount } from '@/lib/billing';
import {
  fetchMembers,
  fetchOtpSends,
  fetchTemplates,
  fetchWallet,
  mapOtpLog,
  type OtpSendRow,
} from '@/lib/orarepot-api';
import type { OtpTemplate } from '@/lib/otp-templates';
import type { TeamMember } from '@/lib/members';
import {
  chartForRange,
  failedCount,
  otpUnitsLeft,
  sentCount,
} from '@/lib/otp-dashboard';
import { getStoredUser } from '@/lib/session';

function formatId(n: number) {
  return n.toLocaleString('id-ID');
}

export function DashboardHomePage() {
  const t = useT();
  const [sends, setSends] = useState<OtpSendRow[]>([]);
  const [templates, setTemplates] = useState<OtpTemplate[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [wallet, setWallet] = useState<BillingAccount | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [greet, setGreet] = useState('Merchant');
  const bgUrl = toAbsoluteUrl('/media/images/2600x1600/bg-3.png');

  useEffect(() => {
    const user = getStoredUser();
    setGreet(user?.full_name || user?.email || 'Merchant');
    Promise.all([
      fetchOtpSends().catch(() => [] as OtpSendRow[]),
      fetchTemplates().catch(() => [] as OtpTemplate[]),
      fetchMembers().catch(() => [] as TeamMember[]),
      fetchWallet().catch(() => null),
    ]).then(([rows, tpls, team, account]) => {
      setSends(rows);
      setTemplates(tpls);
      setMembers(team);
      setWallet(account);
      setLoaded(true);
    });
  }, []);

  const sent = sentCount(sends);
  const failed = failedCount(sends);
  const total = sends.length;
  const rate = total === 0 ? '0%' : `${((sent / total) * 100).toFixed(1)}%`;
  const left = wallet ? remainingBalance(wallet) : 0;
  const units = otpUnitsLeft(left);
  const chart = useMemo(() => chartForRange(sends, '7d'), [sends]);
  const names = useMemo(
    () => new Map(templates.map((item) => [item.id, item.name])),
    [templates],
  );
  const recent = sends.slice(0, 6).map((row) =>
    mapOtpLog(row, names.get(row.template_id) ?? row.template_id),
  );
  const activeTemplates = templates.filter((item) => item.status === 'ACTIVE').length;

  const metrics = [
    { label: t('otp.chartTitle'), value: formatId(sent), icon: Send },
    { label: t('otp.logFailed'), value: formatId(failed), icon: ShieldX },
    { label: 'Success Rate', value: rate, icon: Percent },
    { label: t('otp.unitsLeft'), value: formatId(units), icon: Wallet },
  ];

  return (
    <DashboardShell title={t('menu.overview')} subtitle={t('page.overview')}>
      <div className="grid gap-5 lg:gap-7.5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground m-0">{t('dash.hello')}</p>
            <h2 className="text-xl font-semibold text-mono m-0">{greet}</h2>
          </div>
          <Button asChild>
            <Link href="/dashboard/otp/kirim">
              {t('dash.quickSend')} <ArrowRight />
            </Link>
          </Button>
        </div>

        <div className="grid lg:grid-cols-3 gap-y-5 lg:gap-7.5 items-stretch">
          <div className="lg:col-span-1">
            <div className="grid grid-cols-2 gap-5 lg:gap-7.5 h-full items-stretch">
              {metrics.map((m) => (
                <Card key={m.label} className="h-full">
                  <CardContent
                    className="p-0 flex flex-col justify-between gap-6 h-full bg-cover bg-no-repeat bg-[right_top_-1.7rem]"
                    style={{ backgroundImage: `url('${bgUrl}')` }}
                  >
                    <m.icon className="size-7 mt-4 ms-5 text-primary" />
                    <div className="flex flex-col gap-1 pb-4 px-5">
                      <span className="text-3xl font-semibold text-mono">
                        {loaded ? m.value : '—'}
                      </span>
                      <span className="text-sm font-normal text-muted-foreground">
                        {m.label}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>{t('otp.chartTitle')}</CardTitle>
                <span className="text-sm text-muted-foreground">{t('otp.range7')}</span>
              </CardHeader>
              <CardContent className="px-3 py-1">
                <OtpAreaChart
                  labels={chart.labels}
                  values={chart.delivered}
                  gradientId="dashOtpFill"
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-5 lg:gap-7.5">
          <Card>
            <CardHeader>
              <CardTitle>{t('dash.balance')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-3xl font-semibold text-mono m-0">{formatIdr(left)}</p>
              <p className="text-sm text-muted-foreground m-0">
                {t('otp.unitsLeft')}: {formatId(units)}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/dashboard/billing">
                    <CreditCard /> {t('menu.billing')}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('dash.workspace')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <LayoutTemplate className="size-4 text-muted-foreground" />
                  {t('dash.templates')}
                </div>
                <span className="font-semibold text-mono">
                  {activeTemplates}/{templates.length}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="size-4 text-muted-foreground" />
                  {t('dash.members')}
                </div>
                <span className="font-semibold text-mono">{members.length}</span>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/otp/templates">{t('menu.otpTemplates')}</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('dash.recent')}</CardTitle>
              <Button mode="link" underlined="dashed" asChild>
                <Link href="/dashboard/otp/logs">{t('dash.viewLogs')}</Link>
              </Button>
            </CardHeader>
            <CardContent className="grid gap-3">
              {recent.length === 0 ? (
                <p className="text-sm text-muted-foreground m-0">{t('dash.emptyRecent')}</p>
              ) : (
                recent.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="m-0 font-medium text-mono truncate">{log.nomor}</p>
                      <p className="m-0 text-xs text-muted-foreground truncate">
                        {log.tujuan} · {log.waktu}
                      </p>
                    </div>
                    <Badge
                      size="sm"
                      appearance="light"
                      variant={log.status === 'Success' ? 'success' : 'destructive'}
                    >
                      {log.status === 'Success' ? t('otp.logSuccess') : t('otp.logFailed')}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
