'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  KeyRound,
  LayoutTemplate,
  Lock,
  LogIn,
  MessageSquare,
  Percent,
  Send,
  ShieldX,
  UserPlus,
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
  CardFooter,
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
import { cn } from '@/lib/utils';
import {
  fetchOtpSends,
  fetchTemplates,
  fetchWalletRemaining,
  type OtpSendRow,
} from '@/lib/orarepot-api';
import type { OtpTemplate } from '@/lib/otp-templates';
import {
  chartForRange,
  failedCount,
  otpUnitsLeft,
  periodDeltaPct,
  previousRowsInRange,
  purposeBreakdown,
  rowsInRange,
  sentCount,
} from '@/lib/otp-dashboard';

const PURPOSE_ICONS = [LogIn, UserPlus, Lock, KeyRound];

function formatId(n: number) {
  return n.toLocaleString('id-ID');
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  const up = delta >= 0;
  return (
    <Badge size="sm" variant={up ? 'success' : 'destructive'} appearance="light">
      {up ? '+' : ''}
      {delta.toFixed(1)}%
    </Badge>
  );
}

export function OtpOverviewPage() {
  const t = useT();
  const [range, setRange] = useState('7d');
  const [sends, setSends] = useState<OtpSendRow[]>([]);
  const [templates, setTemplates] = useState<OtpTemplate[]>([]);
  const [remainingIdr, setRemainingIdr] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const bgUrl = toAbsoluteUrl('/media/images/2600x1600/bg-3.png');

  useEffect(() => {
    Promise.all([
      fetchOtpSends().catch(() => [] as OtpSendRow[]),
      fetchTemplates().catch(() => [] as OtpTemplate[]),
      fetchWalletRemaining().catch(() => 0),
    ]).then(([rows, tpls, remaining]) => {
      setSends(rows);
      setTemplates(tpls);
      setRemainingIdr(remaining);
      setLoaded(true);
    });
  }, []);

  const scoped = useMemo(() => rowsInRange(sends, range), [sends, range]);
  const previous = useMemo(
    () => previousRowsInRange(sends, range),
    [sends, range],
  );
  const sent = sentCount(scoped);
  const failed = failedCount(scoped);
  const total = scoped.length;
  const rate = total === 0 ? '0%' : `${((sent / total) * 100).toFixed(1)}%`;
  const units = otpUnitsLeft(remainingIdr);
  const totalDelta = periodDeltaPct(sent, sentCount(previous));
  const purposes = useMemo(
    () =>
      purposeBreakdown(
        scoped.filter((row) => row.status === 'success'),
        templates,
        previous.filter((row) => row.status === 'success'),
      ),
    [scoped, templates, previous],
  );
  const chart = useMemo(() => chartForRange(sends, range), [sends, range]);

  const metrics = [
    { label: t('otp.chartTitle'), value: formatId(sent), icon: Send },
    { label: t('otp.logFailed'), value: formatId(failed), icon: ShieldX },
    { label: 'Success Rate', value: rate, icon: Percent },
    { label: t('otp.unitsLeft'), value: formatId(units), icon: Wallet },
  ];

  return (
    <DashboardShell
      title={t('otp.overviewTitle')}
      subtitle={t('otp.overviewSubtitle')}
    >
      <div className="grid gap-5 lg:gap-7.5">
        <div className="grid lg:grid-cols-3 gap-y-5 lg:gap-7.5 items-stretch">
          <div className="lg:col-span-1">
            <div className="grid grid-cols-2 gap-5 lg:gap-7.5 h-full items-stretch">
              {metrics.map((m) => (
                <Card key={m.label} className="h-full">
                  <CardContent
                    className="p-0 flex flex-col justify-between gap-6 h-full bg-cover bg-no-repeat rtl:bg-[left_top_-1.7rem] bg-[right_top_-1.7rem]"
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
            <Card className="h-full overflow-hidden">
              <CardContent className="relative p-10 min-h-[280px]">
                <div
                  className="pointer-events-none absolute inset-y-0 end-0 w-[55%] hidden sm:block"
                  aria-hidden="true"
                >
                  <div className="absolute end-6 top-8 w-[220px] rotate-6 rounded-xl border border-border bg-card/90 shadow-lg p-4 opacity-90">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="size-8 rounded-full bg-[#25D366] inline-flex items-center justify-center text-white">
                        <MessageSquare className="size-4" />
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-mono">WhatsApp OTP</p>
                        <p className="text-[10px] text-muted-foreground">Official Business</p>
                      </div>
                    </div>
                    <div className="rounded-lg bg-muted/60 p-3 space-y-1.5">
                      <p className="text-[11px] text-secondary-foreground leading-4">
                        Kode verifikasi Anda:
                      </p>
                      <p className="text-lg font-semibold tracking-[0.2em] text-mono">482 913</p>
                      <p className="text-[10px] text-muted-foreground">
                        Berlaku 5 menit · Jangan bagikan
                      </p>
                    </div>
                  </div>
                  <div className="absolute end-28 bottom-10 w-[200px] -rotate-3 rounded-xl border border-border bg-card shadow-md p-3.5 opacity-75">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-medium text-mono">Kirim OTP</span>
                      <Send className="size-3.5 text-primary" />
                    </div>
                    <div className="h-2 rounded bg-muted mb-2 w-3/4" />
                    <div className="h-2 rounded bg-muted mb-3 w-1/2" />
                    <div className="h-7 rounded-md bg-primary/90" />
                  </div>
                </div>

                <div className="relative z-10 flex flex-col justify-center gap-4 max-w-md">
                  <div className="flex -space-x-2">
                    {[1, 2, 3].map((i) => (
                      <img
                        key={i}
                        src={toAbsoluteUrl(`/media/avatars/300-${i}.png`)}
                        alt=""
                        className="size-10 rounded-full border-2 border-background object-cover"
                      />
                    ))}
                    <span className="size-10 rounded-full border-2 border-background bg-[#0f6b66] inline-flex items-center justify-center overflow-hidden">
                      <img
                        src={toAbsoluteUrl('/logo-orarepot-icon.svg')}
                        alt=""
                        className="size-5 object-contain"
                      />
                    </span>
                  </div>
                  <h2 className="text-xl font-semibold text-mono">
                    Kirim OTP sekarang
                    <br />
                    lewat WhatsApp resmi.
                  </h2>
                  <p className="text-sm font-normal text-secondary-foreground leading-5.5">
                    Angka di halaman ini mengikuti pengiriman nyata akun Anda —
                    bukan data contoh.
                  </p>
                </div>
              </CardContent>
              <CardFooter className="justify-center">
                <Button mode="link" underlined="dashed" asChild>
                  <Link href="/dashboard/otp/kirim">
                    Kirim OTP <ArrowRight />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-5 lg:gap-7.5 items-stretch">
          <div className="lg:col-span-1">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Highlights</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-normal text-secondary-foreground">
                    {t('otp.totalSent')}
                  </span>
                  <div className="flex items-center gap-2.5">
                    <span className="text-3xl font-semibold text-mono">
                      {formatId(sent)}
                    </span>
                    <DeltaBadge delta={totalDelta} />
                  </div>
                </div>

                {purposes.length > 0 ? (
                  <>
                    <div className="flex items-center gap-1 mb-1.5">
                      {purposes.map((p) => (
                        <div
                          key={p.label}
                          className={cn('h-2 rounded-xs', p.color)}
                          style={{ width: `${Math.max(p.pct, 2)}%` }}
                        />
                      ))}
                    </div>
                    <div className="flex items-center flex-wrap gap-4 mb-1">
                      {purposes.slice(0, 3).map((p) => (
                        <div key={p.label} className="flex items-center gap-1.5">
                          <span className={cn('size-1.5 rounded-full', p.color)} />
                          <span className="text-sm font-normal text-foreground">
                            {p.label}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="border-b border-input" />
                    <div className="grid gap-3">
                      {purposes.slice(0, 4).map((p, i) => {
                        const Icon = PURPOSE_ICONS[i % PURPOSE_ICONS.length];
                        return (
                          <div
                            key={p.label}
                            className="flex items-center justify-between flex-wrap gap-2"
                          >
                            <div className="flex items-center gap-1.5">
                              <Icon className="size-4.5 text-muted-foreground" />
                              <span className="text-sm font-normal text-mono">
                                {p.label}
                              </span>
                            </div>
                            <div className="flex items-center text-sm font-medium text-foreground gap-6">
                              <span className="lg:text-right">{formatId(p.value)}</span>
                              {p.delta === null ? (
                                <span className="w-14 text-end text-muted-foreground">
                                  —
                                </span>
                              ) : (
                                <span className="flex items-center justify-end gap-1 w-14">
                                  {p.delta >= 0 ? (
                                    <ArrowUp className="text-green-500 size-4" />
                                  ) : (
                                    <ArrowDown className="text-destructive size-4" />
                                  )}
                                  {Math.abs(p.delta).toFixed(1)}%
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground m-0">
                    {t('otp.noSends')}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>{t('otp.chartTitle')}</CardTitle>
                <div className="flex gap-5 items-center">
                  <div className="flex items-center gap-2 text-sm text-secondary-foreground">
                    <LayoutTemplate className="size-4" />
                    {t('otp.allPurposes')}
                  </div>
                  <Select value={range} onValueChange={setRange}>
                    <SelectTrigger className="w-28">
                      <SelectValue placeholder={t('common.filter')} />
                    </SelectTrigger>
                    <SelectContent className="w-28">
                      <SelectItem value="7d">{t('otp.range7')}</SelectItem>
                      <SelectItem value="30d">{t('otp.range30')}</SelectItem>
                      <SelectItem value="12m">{t('otp.range12m')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col justify-end items-stretch grow px-3 py-1">
                <OtpAreaChart labels={chart.labels} values={chart.delivered} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
