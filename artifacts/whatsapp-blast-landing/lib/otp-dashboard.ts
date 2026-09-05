import { OTP_COST_PER_MESSAGE, type OtpTemplate } from '@/lib/otp-templates';
import type { OtpSendRow } from '@/lib/orarepot-api';

export type PurposeSlice = {
  label: string;
  value: number;
  pct: number;
  color: string;
  delta: number | null;
};

export type ChartBucket = {
  labels: string[];
  values: number[];
  delivered: number[];
};

const COLORS = [
  'bg-teal-600',
  'bg-lime-500',
  'bg-violet-500',
  'bg-slate-400',
  'bg-amber-500',
];

const DAY_MS = 86_400_000;

export function sentCount(rows: OtpSendRow[]) {
  return rows.filter((row) => row.status === 'success').length;
}

export function failedCount(rows: OtpSendRow[]) {
  return rows.filter((row) => row.status !== 'success').length;
}

export function successRate(rows: OtpSendRow[]) {
  if (rows.length === 0) return null;
  return (sentCount(rows) / rows.length) * 100;
}

export function parseWhen(row: OtpSendRow) {
  return row.created_at ? new Date(row.created_at) : new Date();
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function rangeDurationMs(range: string) {
  if (range === '12m') return 365 * DAY_MS;
  if (range === '30d') return 30 * DAY_MS;
  return 7 * DAY_MS;
}

export function rowsInRange(rows: OtpSendRow[], range: string) {
  const from = Date.now() - rangeDurationMs(range);
  return rows.filter((row) => parseWhen(row).getTime() >= from);
}

export function previousRowsInRange(rows: OtpSendRow[], range: string) {
  const span = rangeDurationMs(range);
  const from = Date.now() - span * 2;
  const to = Date.now() - span;
  return rows.filter((row) => {
    const t = parseWhen(row).getTime();
    return t >= from && t < to;
  });
}

export function periodDeltaPct(current: number, previous: number): number | null {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return 100;
  return ((current - previous) / previous) * 100;
}

export function purposeBreakdown(
  rows: OtpSendRow[],
  templates: OtpTemplate[],
  previous: OtpSendRow[] = [],
): PurposeSlice[] {
  const names = new Map(templates.map((item) => [item.id, item.name]));
  const counts = new Map<string, number>();
  const prevCounts = new Map<string, number>();
  for (const row of rows) {
    const label = names.get(row.template_id) || 'Lainnya';
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  for (const row of previous) {
    const label = names.get(row.template_id) || 'Lainnya';
    prevCounts.set(label, (prevCounts.get(label) ?? 0) + 1);
  }
  const total = rows.length || 1;
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], index) => ({
      label,
      value,
      pct: (value / total) * 100,
      color: COLORS[index % COLORS.length],
      delta: periodDeltaPct(value, prevCounts.get(label) ?? 0),
    }));
}

function countWindow(rows: OtpSendRow[], start: Date, end: Date) {
  const slice = rows.filter((row) => {
    const t = parseWhen(row);
    return t >= start && t < end;
  });
  return { all: slice.length, ok: sentCount(slice) };
}

export function chartForRange(rows: OtpSendRow[], range: string): ChartBucket {
  const now = new Date();
  if (range === '12m') {
    const labels: string[] = [];
    const values: number[] = [];
    const delivered: number[] = [];
    for (let i = 11; i >= 0; i -= 1) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      labels.push(start.toLocaleDateString('id-ID', { month: 'short' }));
      const bucket = countWindow(rows, start, end);
      values.push(bucket.all);
      delivered.push(bucket.ok);
    }
    return { labels, values, delivered };
  }

  const days = range === '30d' ? 30 : 7;
  const labels: string[] = [];
  const values: number[] = [];
  const delivered: number[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = startOfDay(
      new Date(now.getFullYear(), now.getMonth(), now.getDate() - i),
    );
    const next = new Date(day.getTime() + DAY_MS);
    labels.push(
      days > 7
        ? String(day.getDate())
        : day.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
    );
    const bucket = countWindow(rows, day, next);
    values.push(bucket.all);
    delivered.push(bucket.ok);
  }
  return { labels, values, delivered };
}

export function enrichTemplates(
  templates: OtpTemplate[],
  rows: OtpSendRow[],
): OtpTemplate[] {
  return templates.map((tpl) => {
    const mine = rows.filter((row) => row.template_id === tpl.id);
    const ok = sentCount(mine);
    const chart = chartForRange(mine, '7d');
    const spent = mine.reduce((sum, row) => sum + Number(row.cost_idr ?? 0), 0);
    return {
      ...tpl,
      messagesSent: mine.length,
      messagesDelivered: ok,
      messagesRead: ok,
      readRate: mine.length ? ok / mine.length : 0,
      amountSpent: spent || ok * OTP_COST_PER_MESSAGE,
      series: chart.labels.map((label, i) => ({
        label,
        sent: chart.values[i],
        delivered: chart.delivered[i],
        read: chart.delivered[i],
      })),
    };
  });
}

export function otpUnitsLeft(remainingIdr: number) {
  if (remainingIdr <= 0) return 0;
  return Math.floor(remainingIdr / OTP_COST_PER_MESSAGE);
}
