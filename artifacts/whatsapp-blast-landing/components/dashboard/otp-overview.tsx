'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  KeyRound,
  Lock,
  LogIn,
  MessageSquare,
  MoreVertical,
  Percent,
  Send,
  ShieldX,
  UserPlus,
} from 'lucide-react';
import { toAbsoluteUrl } from '@/lib/helpers';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const METRICS = [
  { label: 'OTP Terkirim', value: '12.483', icon: Send },
  { label: 'Gagal', value: '562', icon: ShieldX },
  { label: 'Success Rate', value: '95.5%', icon: Percent },
];

const RANGE_DATA: Record<string, { labels: string[]; values: number[] }> = {
  '7d': {
    labels: ['13 Mei', '14 Mei', '15 Mei', '16 Mei', '17 Mei', '18 Mei', '19 Mei'],
    values: [1680, 1920, 1750, 2100, 2380, 2210, 2560],
  },
  '30d': {
    labels: ['W1', 'W2', 'W3', 'W4'],
    values: [9200, 10100, 11400, 12483],
  },
  '12m': {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
    values: [6200, 7100, 6800, 7900, 8600, 9200, 9800, 10500, 11200, 11800, 12100, 12483],
  },
};

const PURPOSES = [
  { label: 'Login', value: 8721, pct: 69.9, color: 'bg-teal-600', hex: '#0f6b66', icon: LogIn, up: true, delta: 3.9 },
  { label: 'Registrasi', value: 2345, pct: 18.8, color: 'bg-lime-500', hex: '#84cc16', icon: UserPlus, up: true, delta: 8.2 },
  { label: 'Reset Password', value: 1102, pct: 8.8, color: 'bg-violet-500', hex: '#8b5cf6', icon: Lock, up: false, delta: 0.7 },
  { label: 'Lainnya', value: 315, pct: 2.5, color: 'bg-slate-400', hex: '#94a3b8', icon: KeyRound, up: true, delta: 1.2 },
];

function formatId(n: number) {
  return n.toLocaleString('id-ID');
}

function AreaChart({
  labels,
  values,
}: {
  labels: string[];
  values: number[];
}) {
  const width = 640;
  const height = 250;
  const pad = { top: 16, right: 12, bottom: 32, left: 40 };
  const max = Math.max(...values) * 1.1;
  const min = 0;
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const points = values.map((v, i) => {
    const x = pad.left + (i / Math.max(values.length - 1, 1)) * innerW;
    const y = pad.top + innerH - ((v - min) / (max - min)) * innerH;
    return { x, y, v, label: labels[i] };
  });

  const line = points.map((p) => `${p.x},${p.y}`).join(' ');
  const area = `${pad.left},${pad.top + innerH} ${line} ${pad.left + innerW},${pad.top + innerH}`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: pad.top + innerH * (1 - t),
    label: t === 0 ? '0' : `${Math.round((max * t) / 1000)}K`,
  }));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[250px]" role="img">
      <defs>
        <linearGradient id="otpAreaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {yTicks.map((tick) => (
        <g key={tick.label}>
          <line
            x1={pad.left}
            x2={width - pad.right}
            y1={tick.y}
            y2={tick.y}
            stroke="var(--color-border)"
            strokeDasharray="5 5"
          />
          <text
            x={pad.left - 8}
            y={tick.y + 4}
            textAnchor="end"
            className="fill-muted-foreground"
            fontSize="12"
          >
            {tick.label}
          </text>
        </g>
      ))}

      <polygon points={area} fill="url(#otpAreaFill)" />
      <polyline
        points={line}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {points.map((p, i) => {
        const show =
          points.length <= 8 ||
          i === 0 ||
          i === points.length - 1 ||
          i % Math.ceil(points.length / 6) === 0;
        if (!show) return null;
        return (
          <text
            key={`x-${p.label}`}
            x={p.x}
            y={height - 10}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize="12"
          >
            {p.label}
          </text>
        );
      })}
    </svg>
  );
}

/**
 * Layout mirrors Metronic demo1 light-sidebar:
 * Row 1: 2x2 stats (1 col) + callout (2 cols)
 * Row 2: Highlights (1 col) + area chart (2 cols)
 */
export function OtpOverviewPage() {
  const t = useT();
  const [range, setRange] = useState('7d');
  const chart = useMemo(() => RANGE_DATA[range] ?? RANGE_DATA['7d'], [range]);
  const bgUrl = toAbsoluteUrl('/media/images/2600x1600/bg-3.png');

  return (
    <DashboardShell
      title={t('otp.overviewTitle')}
      subtitle={t('otp.overviewSubtitle')}
    >
      <div className="grid gap-5 lg:gap-7.5">
        {/* Row 1 — ChannelStats 2x2 + EntryCallout */}
        <div className="grid lg:grid-cols-3 gap-y-5 lg:gap-7.5 items-stretch">
          <div className="lg:col-span-1">
            <div className="grid grid-cols-2 gap-5 lg:gap-7.5 h-full items-stretch">
              {METRICS.map((m) => (
                <Card key={m.label} className="h-full">
                  <CardContent
                    className="p-0 flex flex-col justify-between gap-6 h-full bg-cover bg-no-repeat rtl:bg-[left_top_-1.7rem] bg-[right_top_-1.7rem]"
                    style={{ backgroundImage: `url('${bgUrl}')` }}
                  >
                    <m.icon className="size-7 mt-4 ms-5 text-primary" />
                    <div className="flex flex-col gap-1 pb-4 px-5">
                      <span className="text-3xl font-semibold text-mono">{m.value}</span>
                      <span className="text-sm font-normal text-muted-foreground">{m.label}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2">
            <Card className="h-full overflow-hidden">
              <CardContent className="relative p-10 min-h-[280px]">
                {/* Floating OTP send illustration (Metronic branded-auth style) */}
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
                      <p className="text-[10px] text-muted-foreground">Berlaku 5 menit · Jangan bagikan</p>
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
                    <span className="size-10 rounded-full border-2 border-background bg-green-500 text-white text-xs font-medium inline-flex items-center justify-center">
                      +
                    </span>
                  </div>
                  <h2 className="text-xl font-semibold text-mono">
                    Kirim OTP sekarang
                    <br />
                    lewat WhatsApp resmi.
                  </h2>
                  <p className="text-sm font-normal text-secondary-foreground leading-5.5">
                    Pantau pengiriman, verifikasi, dan success rate dari satu
                    dashboard. Siap dihubungkan ke API production.
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

        {/* Row 2 — Highlights + Earnings chart */}
        <div className="grid lg:grid-cols-3 gap-5 lg:gap-7.5 items-stretch">
          <div className="lg:col-span-1">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Highlights</CardTitle>
                <Button variant="ghost" mode="icon">
                  <MoreVertical className="size-4 text-muted-foreground" />
                </Button>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-normal text-secondary-foreground">
                    Total OTP terkirim
                  </span>
                  <div className="flex items-center gap-2.5">
                    <span className="text-3xl font-semibold text-mono">12.483</span>
                    <Badge size="sm" variant="success" appearance="light">
                      +2.7%
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center gap-1 mb-1.5">
                  {PURPOSES.map((p) => (
                    <div
                      key={p.label}
                      className={cn('h-2 rounded-xs', p.color)}
                      style={{ width: `${p.pct}%` }}
                    />
                  ))}
                </div>
                <div className="flex items-center flex-wrap gap-4 mb-1">
                  {PURPOSES.slice(0, 3).map((p) => (
                    <div key={p.label} className="flex items-center gap-1.5">
                      <span className={cn('size-1.5 rounded-full', p.color)} />
                      <span className="text-sm font-normal text-foreground">{p.label}</span>
                    </div>
                  ))}
                </div>

                <div className="border-b border-input" />

                <div className="grid gap-3">
                  {PURPOSES.slice(0, 3).map((p) => (
                    <div
                      key={p.label}
                      className="flex items-center justify-between flex-wrap gap-2"
                    >
                      <div className="flex items-center gap-1.5">
                        <p.icon className="size-4.5 text-muted-foreground" />
                        <span className="text-sm font-normal text-mono">{p.label}</span>
                      </div>
                      <div className="flex items-center text-sm font-medium text-foreground gap-6">
                        <span className="lg:text-right">{formatId(p.value)}</span>
                        <span className="flex items-center justify-end gap-1 w-14">
                          {p.up ? (
                            <ArrowUp className="text-green-500 size-4" />
                          ) : (
                            <ArrowDown className="text-destructive size-4" />
                          )}
                          {p.delta}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>{t('otp.chartTitle')}</CardTitle>
                <div className="flex gap-5 items-center">
                  <div className="flex items-center gap-2 text-sm text-secondary-foreground">
                    <MessageSquare className="size-4" />
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
                <AreaChart labels={chart.labels} values={chart.values} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
