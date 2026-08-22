'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowDown,
  ArrowLeft,
  BarChart3,
  Check,
  Copy,
  Info,
  MoreVertical,
  Pencil,
  Star,
  X,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { useT } from '@/components/i18n/locale-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CATEGORY_LABEL,
  formatDateId,
  formatIdr,
  getTemplateById,
  renderBodySample,
  type OtpTemplate,
  type OtpTemplateMetricPoint,
} from '@/lib/otp-templates';
import { cn } from '@/lib/utils';

function statusBadge(t: OtpTemplate) {
  if (t.status === 'REJECTED') {
    return (
      <Badge variant="destructive" appearance="light" size="sm">
        {t.statusLabel}
      </Badge>
    );
  }
  if (t.status === 'PENDING') {
    return (
      <Badge variant="warning" appearance="light" size="sm">
        {t.statusLabel}
      </Badge>
    );
  }
  if (t.status === 'PAUSED') {
    return (
      <Badge variant="secondary" appearance="light" size="sm">
        {t.statusLabel}
      </Badge>
    );
  }
  return (
    <Badge variant="success" appearance="light" size="sm">
      {t.statusLabel}
    </Badge>
  );
}

function TrendChart({ series }: { series: OtpTemplateMetricPoint[] }) {
  const width = 640;
  const height = 240;
  const pad = { top: 16, right: 12, bottom: 32, left: 36 };
  const max = Math.max(
    1,
    ...series.flatMap((p) => [p.delivered, p.sent, p.read]),
  ) * 1.15;
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const toPoints = (key: 'delivered' | 'sent' | 'read') =>
    series
      .map((p, i) => {
        const x = pad.left + (i / Math.max(series.length - 1, 1)) * innerW;
        const y = pad.top + innerH - (p[key] / max) * innerH;
        return `${x},${y}`;
      })
      .join(' ');

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: pad.top + innerH * (1 - t),
    label: Math.round(max * t),
  }));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[240px]" role="img">
      {yTicks.map((tick) => (
        <g key={tick.label}>
          <line
            x1={pad.left}
            x2={width - pad.right}
            y1={tick.y}
            y2={tick.y}
            stroke="var(--color-border)"
            strokeDasharray="4 4"
          />
          <text
            x={pad.left - 8}
            y={tick.y + 4}
            textAnchor="end"
            className="fill-muted-foreground"
            fontSize="11"
          >
            {tick.label}
          </text>
        </g>
      ))}
      <polyline
        fill="none"
        stroke="#8b5cf6"
        strokeWidth="2"
        points={toPoints('delivered')}
      />
      <polyline
        fill="none"
        stroke="#14b8a6"
        strokeWidth="2"
        points={toPoints('sent')}
      />
      <polyline
        fill="none"
        stroke="#ec4899"
        strokeWidth="2"
        points={toPoints('read')}
      />
      {series.map((p, i) => {
        if (i % Math.ceil(series.length / 6) !== 0 && i !== series.length - 1) {
          return null;
        }
        const x = pad.left + (i / Math.max(series.length - 1, 1)) * innerW;
        return (
          <text
            key={p.label}
            x={x}
            y={height - 10}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize="11"
          >
            {p.label}
          </text>
        );
      })}
    </svg>
  );
}

export function OtpTemplateDetailPage({ id }: { id: string }) {
  const t = useT();
  const router = useRouter();
  const [template, setTemplate] = useState<OtpTemplate | null | undefined>(
    undefined,
  );
  const [copied, setCopied] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(true);

  useEffect(() => {
    const found = getTemplateById(id);
    setTemplate(found ?? null);
    if (!found) {
      router.replace('/dashboard/otp/templates');
    }
  }, [id, router]);

  const sampleBody = useMemo(
    () => (template ? renderBodySample(template.body) : ''),
    [template],
  );

  const deltaDelivered = -15.6;
  const deltaSent = -18.3;
  const deltaRead = -7.6;

  if (template === undefined) {
    return (
      <DashboardShell title={t('otp.templatesTitle')} subtitle={t('common.loading')}>
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground text-sm">
            {t('otp.loadingTemplate')}
          </CardContent>
        </Card>
      </DashboardShell>
    );
  }

  if (!template) return null;

  const readPct = Math.round(template.readRate * 100);

  return (
    <DashboardShell
      title={`${template.name} · ${template.language}`}
      subtitle={undefined}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/otp/templates">
              <ArrowLeft /> {t('otp.back')}
            </Link>
          </Button>
          <span className="text-xs text-muted-foreground hidden md:inline px-2 py-1.5 rounded-md border border-border bg-card">
            15 Agu 2026 – 22 Agu 2026
          </span>
          <Button variant="outline" size="sm" disabled>
            <Pencil /> {t('otp.editTemplate')}
          </Button>
          <Button variant="outline" mode="icon" size="sm" disabled>
            <MoreVertical />
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {statusBadge(template)}
          <span className="text-muted-foreground">·</span>
          <span>{CATEGORY_LABEL[template.category]}</span>
          <span className="text-muted-foreground">·</span>
          <span>Diperbarui {formatDateId(template.updatedAt)}</span>
          <span className="text-muted-foreground">·</span>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground font-mono text-xs"
            onClick={async () => {
              await navigator.clipboard.writeText(template.metaId);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {template.metaId}
            {copied ? (
              <Check className="size-3.5 text-green-600" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </button>
        </div>

        {bannerOpen && (
          <div className="flex items-start gap-3 rounded-xl border border-violet-200 bg-violet-50/80 dark:bg-violet-950/30 dark:border-violet-800 px-4 py-3">
            <Star className="size-4 text-violet-600 mt-0.5 shrink-0" />
            <p className="text-sm text-foreground m-0 flex-1">
              Setelah API integrasi aktif, metrik pengiriman & biaya di sini
              dihitung otomatis dari data Meta Cloud API.{' '}
              <span className="text-primary font-medium">Pelajari lebih lanjut</span>
            </p>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              aria-label="Tutup"
              onClick={() => setBannerOpen(false)}
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-12 lg:gap-7.5 items-start">
          {/* Left column */}
          <div className="lg:col-span-4 flex flex-col gap-5">
            <Card>
              <CardHeader>
                <CardTitle>Template Anda</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl bg-[#e5ddd5] dark:bg-muted p-4 min-h-[200px] relative overflow-hidden">
                  <div
                    className="absolute inset-0 opacity-20 pointer-events-none"
                    style={{
                      backgroundImage:
                        'radial-gradient(circle at 20% 20%, #fff 1px, transparent 1px)',
                      backgroundSize: '18px 18px',
                    }}
                  />
                  <div className="relative max-w-[85%] rounded-lg bg-[#dcf8c6] dark:bg-green-900/40 shadow-sm px-3 py-2">
                    <p className="text-sm text-foreground m-0 leading-5 whitespace-pre-wrap">
                      {sampleBody}
                    </p>
                    {template.buttonLabel ? (
                      <button
                        type="button"
                        className="mt-2 w-full rounded-md bg-white dark:bg-card border border-border/60 text-primary text-sm font-medium py-1.5 inline-flex items-center justify-center gap-1.5"
                      >
                        <Copy className="size-3.5" />
                        {template.buttonLabel}
                      </button>
                    ) : null}
                    <p className="text-[10px] text-muted-foreground text-end m-0 mt-1">
                      10.34
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center justify-between gap-3 py-4">
                <div className="flex items-center gap-3">
                  <span className="size-10 rounded-lg bg-primary/10 text-primary inline-flex items-center justify-center">
                    <BarChart3 className="size-5" />
                  </span>
                  <div>
                    <p className="text-sm font-medium m-0">Lihat gambar lengkap</p>
                    <p className="text-xs text-muted-foreground m-0">
                      Insight akun dari API
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" disabled>
                  Lihat insight akun
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Alasan utama pemblokiran</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  {t('otp.last7days')}
                </p>
                <p className="text-sm text-muted-foreground m-0">--</p>
              </CardContent>
            </Card>
          </div>

          {/* Right column */}
          <div className="lg:col-span-8 flex flex-col gap-5">
            <div className="grid sm:grid-cols-3 gap-5">
              <KpiCard
                label="Jumlah yang dibelanjakan"
                value={formatIdr(template.amountSpent)}
              />
              <KpiCard
                label="Biaya per pesan yang dikirim"
                value={formatIdr(template.costPerMessage)}
              />
              <KpiCard
                label="Biaya per klik tombol situs web"
                value="--"
              />
            </div>

            <Card>
              <CardHeader className="flex-wrap gap-3">
                <CardTitle>Kinerja</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <Tabs defaultValue="tren">
                  <TabsList variant="default" size="sm" className="w-fit mb-4">
                    <TabsTrigger value="tren">Tren</TabsTrigger>
                    <TabsTrigger value="corong">Corong</TabsTrigger>
                  </TabsList>

                  <TabsContent value="tren" className="mt-0 space-y-5">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <MetricMini
                        label="Pesan terkirim"
                        value={template.messagesDelivered.toLocaleString('id-ID')}
                        delta={deltaDelivered}
                      />
                      <MetricMini
                        label="Pesan dikirim"
                        value={template.messagesSent.toLocaleString('id-ID')}
                        delta={deltaSent}
                      />
                      <MetricMini
                        label="Pesan dibaca"
                        value={`${template.messagesRead.toLocaleString('id-ID')} (${readPct}%)`}
                        delta={deltaRead}
                      />
                      <MetricMini
                        label="Balasan unik"
                        value={template.uniqueReplies.toLocaleString('id-ID')}
                      />
                    </div>

                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground">
                        4 metrik dipilih (mock)
                      </span>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <i className="size-2 rounded-full bg-violet-500" />{' '}
                          Terkirim
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <i className="size-2 rounded-full bg-teal-500" />{' '}
                          Dikirim
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <i className="size-2 rounded-full bg-pink-500" />{' '}
                          Dibaca
                        </span>
                      </div>
                    </div>
                    <TrendChart series={template.series} />
                  </TabsContent>

                  <TabsContent value="corong" className="mt-0">
                    <div className="py-16 text-center text-sm text-muted-foreground">
                      Corong konversi tersedia setelah data API terhubung.
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-5 px-5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-xs text-muted-foreground m-0 leading-4">{label}</p>
          <Info className="size-3.5 text-muted-foreground shrink-0" />
        </div>
        <p className="text-xl font-semibold text-mono m-0">{value}</p>
      </CardContent>
    </Card>
  );
}

function MetricMini({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-3">
      <p className="text-[11px] text-muted-foreground m-0 mb-1">{label}</p>
      <p className="text-lg font-semibold text-mono m-0">{value}</p>
      {typeof delta === 'number' ? (
        <p
          className={cn(
            'text-xs m-0 mt-1 inline-flex items-center gap-0.5',
            delta < 0 ? 'text-destructive' : 'text-green-600',
          )}
        >
          <ArrowDown
            className={cn('size-3', delta >= 0 && 'rotate-180')}
          />
          {Math.abs(delta)}%
        </p>
      ) : null}
    </div>
  );
}
