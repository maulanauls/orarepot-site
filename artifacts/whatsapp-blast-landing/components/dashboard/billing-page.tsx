'use client';

import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { useRouter } from 'next/navigation';
import { Bot, CreditCard, FileText, Radio, ShieldCheck } from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { useLocale } from '@/components/i18n/locale-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  FEATURES,
  createPaySession,
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
import { midtransLanguage } from '@/lib/midtrans';
import { loadMidtransSnap } from '@/lib/midtrans-snap';
import { createTopup, fetchInvoices, fetchPayment, fetchWallet, type PaymentRow } from '@/lib/orarepot-api';
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

function orderIdOf(inv: Invoice) {
  if (inv.orderId) return inv.orderId;
  const match = inv.label.match(/ORP-[0-9a-f]+/i);
  return match?.[0];
}

function canReopenInvoice(inv: Invoice) {
  if (inv.status !== 'pending' || !orderIdOf(inv)) return false;
  return (
    !inv.paymentType ||
    inv.paymentType === 'qris' ||
    inv.paymentType === 'bank_transfer' ||
    inv.paymentType === 'echannel'
  );
}

export function BillingPage() {
  const { t, locale } = useLocale();
  const router = useRouter();
  const snapLanguage = midtransLanguage(locale);
  const [account, setAccount] = useState<BillingAccount | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [amount, setAmount] = useState(50_000);
  const [custom, setCustom] = useState('');
  const [method, setMethod] = useState<PayMethod>('qris');
  const [bank, setBank] = useState('bca');
  const [submitting, setSubmitting] = useState(false);
  const [payError, setPayError] = useState('');
  const [qris, setQris] = useState<{
    orderId: string;
    amount: number;
    qr: string;
    expiresAt?: string;
  } | null>(null);
  const [va, setVa] = useState<{
    orderId: string;
    amount: number;
    bankId: string;
    bank: string;
    number: string;
    billerCode?: string;
    expiresAt?: string;
  } | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [openingOrder, setOpeningOrder] = useState('');
  const [emailedTo, setEmailedTo] = useState('');
  const [payPaid, setPayPaid] = useState(false);
  const watchOrder = qris?.orderId ?? va?.orderId ?? '';

  const hasPending = invoices.some((inv) => inv.status === 'pending');

  useEffect(() => {
    fetchWallet()
      .then(setAccount)
      .catch(() => setAccount(null));
    fetchInvoices()
      .then(setInvoices)
      .catch(() => setInvoices([]));
  }, []);

  useEffect(() => {
    if (!hasPending) return;
    const timer = window.setInterval(() => {
      fetchWallet()
        .then(setAccount)
        .catch(() => undefined);
      fetchInvoices()
        .then(setInvoices)
        .catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [hasPending]);

  useEffect(() => {
    if (!watchOrder) return;
    let cancelled = false;
    const timer = window.setInterval(() => {
      fetchPayment(watchOrder)
        .then((row) => {
          if (cancelled) return;
          if (row.status === 'paid') {
            setPayPaid(true);
            setPayOpen(false);
            setEmailedTo('');
            setQris(null);
            setVa(null);
            fetchWallet().then(setAccount).catch(() => undefined);
            fetchInvoices().then(setInvoices).catch(() => undefined);
          } else if (row.status === 'expired') {
            setPayError(t('billing.sessionExpired'));
            setPayOpen(false);
            setEmailedTo('');
            setQris(null);
            setVa(null);
            fetchInvoices().then(setInvoices).catch(() => undefined);
          } else if (row.status === 'failed' || row.status === 'canceled') {
            setPayError(t('billing.errorLead'));
            setPayOpen(false);
            setEmailedTo('');
            setQris(null);
            setVa(null);
          }
        })
        .catch(() => undefined);
    }, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [watchOrder, t]);

  const payAmount = custom ? Number(custom.replace(/\D/g, '')) || 0 : amount;
  const left = account ? remainingBalance(account) : 0;
  const liveSession = !!qris || !!va;
  const pendingInvoice = invoices.find(canReopenInvoice);
  const sessionOpen = liveSession || !!pendingInvoice;

  const canSubmit = useMemo(
    () => payAmount >= 10_000 && (!!method && (method !== 'va' || !!bank)),
    [payAmount, method, bank],
  );

  function showPayment(row: PaymentRow) {
    const expiresAt = row.expires_at || undefined;
    if (row.qr_string) {
      setVa(null);
      setQris({
        orderId: row.order_id,
        amount: Number(row.amount_idr),
        qr: row.qr_string,
        expiresAt,
      });
      setPayOpen(true);
      return true;
    }
    if (row.va_number) {
      const bankId = (row.bank || 'bca').toLowerCase();
      const known = VA_BANKS.find((item) => item.id === bankId);
      setQris(null);
      setVa({
        orderId: row.order_id,
        amount: Number(row.amount_idr),
        bankId,
        bank: known?.label || bankId.toUpperCase(),
        number: row.va_number,
        billerCode: row.biller_code || undefined,
        expiresAt,
      });
      setPayOpen(true);
      return true;
    }
    return false;
  }

  async function openPending(inv: Invoice) {
    const orderId = orderIdOf(inv);
    if (inv.status !== 'pending' || !orderId) return;
    if (qris?.orderId === orderId || va?.orderId === orderId) {
      setPayOpen(true);
      return;
    }
    setOpeningOrder(orderId);
    setPayError('');
    setPayPaid(false);
    try {
      const row = await fetchPayment(orderId);
      if (row.status === 'paid') {
        setPayPaid(true);
        setPayOpen(false);
        setEmailedTo('');
        setQris(null);
        setVa(null);
        fetchWallet().then(setAccount).catch(() => undefined);
        fetchInvoices().then(setInvoices).catch(() => undefined);
        return;
      }
      if (row.status !== 'pending' || !showPayment(row)) {
        setPayError(
          row.status === 'pending' ? t('billing.reopenMissing') : t('billing.sessionExpired'),
        );
        setPayOpen(false);
        setEmailedTo('');
        setQris(null);
        setVa(null);
        fetchInvoices().then(setInvoices).catch(() => undefined);
      }
    } catch {
      setPayError(t('billing.errorLead'));
    } finally {
      setOpeningOrder('');
    }
  }

  async function onTopup() {
    if (!canSubmit) return;
    setSubmitting(true);
    setPayError('');
    setPayPaid(false);
    try {
      const user = getStoredUser();
      const customerName = user?.full_name || user?.email || 'Merchant';
      const customerRef = user?.email?.split('@')[0] || 'ORAREPOT';
      const customerEmail = user?.email || '';
      createPaySession({
        amount: payAmount,
        method,
        bank: method === 'va' ? bank : undefined,
        customerName,
        customerRef,
      });

      const pending = await createTopup({
        amountIdr: payAmount,
        customerName,
        customerRef,
        customerEmail,
        language: snapLanguage,
        origin: window.location.origin,
        method,
        bank: method === 'va' ? bank : undefined,
      });
      setEmailedTo(pending.emailed && customerEmail ? customerEmail : '');

      if (method === 'qris' && pending.qr_string) {
        setVa(null);
        setQris({
          orderId: pending.order_id,
          amount: pending.amount_idr,
          qr: pending.qr_string,
          expiresAt: pending.expires_at || undefined,
        });
        setPayOpen(true);
        fetchInvoices().then(setInvoices).catch(() => undefined);
        setSubmitting(false);
        return;
      }

      if (method === 'va' && pending.va_number) {
        const bankId = (pending.bank || bank).toLowerCase();
        const known = VA_BANKS.find((item) => item.id === bankId);
        setQris(null);
        setVa({
          orderId: pending.order_id,
          amount: pending.amount_idr,
          bankId,
          bank: known?.label || bankId.toUpperCase(),
          number: pending.va_number,
          billerCode: pending.biller_code || undefined,
          expiresAt: pending.expires_at || undefined,
        });
        setPayOpen(true);
        fetchInvoices().then(setInvoices).catch(() => undefined);
        setSubmitting(false);
        return;
      }

      let token = pending.snap_token ?? '';
      if (!token) {
        const res = await fetch('/api/pay/snap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: pending.order_id,
            amount: pending.amount_idr,
            customerName,
            customerRef,
            language: snapLanguage,
          }),
        });
        const data = (await res.json()) as {
          token?: string;
          error?: string;
        };
        if (!res.ok || !data.token) {
          throw new Error(data.error || t('billing.snapError'));
        }
        token = data.token;
      }

      const snap = await loadMidtransSnap();
      const orderId = pending.order_id;
      snap.pay(token, {
        language: snapLanguage,
        onSuccess: () => {
          router.push(`/pay/finish?order_id=${encodeURIComponent(orderId)}`);
        },
        onPending: () => {
          router.push(`/pay/finish?order_id=${encodeURIComponent(orderId)}`);
        },
        onError: () => {
          router.push(`/pay/error?order_id=${encodeURIComponent(orderId)}`);
        },
        onClose: () => {
          setSubmitting(false);
        },
      });
    } catch (error) {
      setSubmitting(false);
      setPayError(
        error instanceof Error && error.message
          ? error.message
          : t('billing.snapError'),
      );
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
                      disabled={sessionOpen}
                      onClick={() => {
                        setAmount(preset);
                        setCustom('');
                      }}
                      className={cn(
                        'rounded-md border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50',
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
                  disabled={sessionOpen}
                  onChange={(e) => setCustom(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('billing.payMethod')}</Label>
                <div className="grid sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={sessionOpen}
                    onClick={() => setMethod('qris')}
                    className={cn(
                      'rounded-lg border px-4 py-3 text-start transition-colors disabled:opacity-60',
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
                    disabled={sessionOpen}
                    onClick={() => setMethod('va')}
                    className={cn(
                      'rounded-lg border px-4 py-3 text-start transition-colors disabled:opacity-60',
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {VA_BANKS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        disabled={sessionOpen}
                        onClick={() => setBank(item.id)}
                        className={cn(
                          'flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-start transition-colors disabled:opacity-60',
                          bank === item.id
                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                            : 'border-border hover:bg-muted/60',
                        )}
                      >
                        <BankMark id={item.id} />
                        <span className="text-sm font-medium">{item.label}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              {sessionOpen && !(payOpen && liveSession) ? (
                <div className="rounded-lg border border-border px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium m-0">{t('billing.sessionWaiting')}</p>
                    <PayTimer
                      expiresAt={qris?.expiresAt ?? va?.expiresAt ?? pendingInvoice?.expiresAt}
                      label={t('billing.timeLeft')}
                      compact
                    />
                  </div>
                  <Button
                    type="button"
                    disabled={!!openingOrder}
                    onClick={() => {
                      if (liveSession) setPayOpen(true);
                      else if (pendingInvoice) void openPending(pendingInvoice);
                    }}
                  >
                    {t('billing.reopenPay')}
                  </Button>
                </div>
              ) : null}
              {payPaid ? (
                <p className="text-sm text-primary m-0">{t('billing.qrisPaid')}</p>
              ) : null}
              {payError ? (
                <p className="text-sm text-destructive m-0">{payError}</p>
              ) : null}
            </CardContent>
            <CardFooter className="justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground m-0">{t('billing.youPay')}</p>
                <p className="text-lg font-semibold text-mono m-0">{formatIdr(payAmount)}</p>
              </div>
              <Button onClick={onTopup} disabled={!canSubmit || submitting || !!qris || !!va}>
                <CreditCard />
                {submitting
                  ? method === 'qris'
                    ? t('billing.qrisOpening')
                    : method === 'va'
                      ? t('billing.vaOpening')
                      : t('billing.openingSnap')
                  : method === 'qris'
                    ? t('billing.showQris')
                    : method === 'va'
                      ? t('billing.showVa')
                      : t('billing.continuePay')}
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
                  {invoices.map((inv) => {
                    const orderId = orderIdOf(inv);
                    const reopenable = canReopenInvoice(inv);
                    const opening = openingOrder === orderId;
                    return (
                    <tr
                      key={inv.id}
                      tabIndex={reopenable ? 0 : undefined}
                      onClick={() => {
                        if (reopenable && !opening) void openPending(inv);
                      }}
                      onKeyDown={(event) => {
                        if (!reopenable || opening) return;
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          void openPending(inv);
                        }
                      }}
                      className={cn(
                        'border-b border-border last:border-0',
                        reopenable && 'cursor-pointer hover:bg-muted/50',
                        opening && 'opacity-60',
                      )}
                    >
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
                        {reopenable ? (
                          <span className="inline-flex items-center gap-2">
                            <Badge variant="warning" appearance="light" size="sm">
                              {t('billing.pending')}
                            </Badge>
                            <span className="text-xs font-medium text-primary">
                              {t('billing.reopenPay')}
                            </span>
                          </span>
                        ) : (
                          <Badge
                            variant={
                              inv.status === 'paid'
                                ? 'success'
                                : inv.status === 'void'
                                  ? 'secondary'
                                  : 'warning'
                            }
                            appearance="light"
                            size="sm"
                          >
                            {inv.status === 'paid'
                              ? t('billing.paid')
                              : inv.status === 'void'
                                ? t('billing.expired')
                                : t('billing.pending')}
                          </Badge>
                        )}
                      </td>
                      <td className="px-5 py-3 text-end font-medium">{formatIdr(inv.amount)}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
      <Dialog open={payOpen && liveSession} onOpenChange={setPayOpen}>
        <DialogContent variant="fullscreen" className="overflow-y-auto">
          <DialogHeader className="items-center text-center">
            <DialogTitle>{qris ? t('billing.qrisTitle') : t('billing.vaTitle')}</DialogTitle>
            <DialogDescription>{t('billing.modalKeep')}</DialogDescription>
            {emailedTo ? (
              <p className="text-sm text-muted-foreground m-0">{t('billing.emailSent', { email: emailedTo })}</p>
            ) : null}
          </DialogHeader>
          <DialogBody className="mx-auto flex w-full max-w-md flex-col items-center gap-5">
            <PayTimer
              expiresAt={qris?.expiresAt ?? va?.expiresAt}
              label={t('billing.timeLeft')}
            />
            {qris ? (
              <QrisPanel
                qr={qris.qr}
                amountLabel={formatIdr(qris.amount)}
                orderId={qris.orderId}
                title={t('billing.qrisTitle')}
                wait={t('billing.qrisWait')}
              />
            ) : null}
            {va ? (
              <VaPanel
                bankId={va.bankId}
                bank={va.bank}
                number={va.number}
                billerCode={va.billerCode}
                amountLabel={formatIdr(va.amount)}
                orderId={va.orderId}
                title={t('billing.vaTitle')}
                numberLabel={t('billing.vaNumber')}
                billerLabel={t('billing.vaBiller')}
                billKeyLabel={t('billing.vaBillKey')}
                wait={t('billing.vaWait')}
                copyLabel={t('billing.vaCopy')}
                copiedLabel={t('billing.vaCopied')}
              />
            ) : null}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

function PayTimer({
  expiresAt,
  label,
  compact = false,
}: {
  expiresAt?: string;
  label: string;
  compact?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!expiresAt) return null;
  const left = Math.max(0, new Date(expiresAt).getTime() - now);
  const minutes = Math.floor(left / 60000);
  const seconds = Math.floor((left % 60000) / 1000);
  const clock = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const urgent = left > 0 && left < 5 * 60 * 1000;

  if (compact) {
    return (
      <p className={cn('text-sm text-mono m-0 mt-1', urgent && 'text-destructive')}>
        {label} {clock}
      </p>
    );
  }

  return (
    <div className={cn('text-center', urgent && 'text-destructive')}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground m-0">{label}</p>
      <p className="text-4xl font-semibold text-mono m-0 mt-1 tabular-nums">{clock}</p>
    </div>
  );
}

function QrisPanel({
  qr,
  amountLabel,
  orderId,
  title,
  wait,
}: {
  qr: string;
  amountLabel: string;
  orderId: string;
  title: string;
  wait: string;
}) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(qr, { width: 280, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc('');
      });
    return () => {
      cancelled = true;
    };
  }, [qr]);

  return (
    <div className="rounded-lg border border-border px-4 py-4 text-center">
      <p className="text-sm font-semibold m-0">{title}</p>
      <p className="text-lg font-semibold text-mono m-0 mt-1">{amountLabel}</p>
      {src ? (
        <img src={src} alt="QRIS" width={280} height={280} className="mx-auto mt-3" />
      ) : null}
      <p className="text-xs text-muted-foreground m-0 mt-2">{orderId}</p>
      <p className="text-sm text-muted-foreground m-0 mt-2">{wait}</p>
    </div>
  );
}

const BANK_LOGOS: Record<string, string> = {
  bca: '/banks/bca.svg',
  mandiri: '/banks/mandiri.svg',
  bri: '/banks/bri.svg',
  bni: '/banks/bni.svg',
  permata: '/banks/permata.svg',
  cimb: '/banks/cimb.svg',
};

function BankMark({ id }: { id: string }) {
  const src = BANK_LOGOS[id];
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      width={70}
      height={50}
      className="h-[50px] w-[70px] shrink-0 object-contain"
    />
  );
}

function VaPanel({
  bankId,
  bank,
  number,
  billerCode,
  amountLabel,
  orderId,
  title,
  numberLabel,
  billerLabel,
  billKeyLabel,
  wait,
  copyLabel,
  copiedLabel,
}: {
  bankId: string;
  bank: string;
  number: string;
  billerCode?: string;
  amountLabel: string;
  orderId: string;
  title: string;
  numberLabel: string;
  billerLabel: string;
  billKeyLabel: string;
  wait: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState('');

  async function copy(value: string, key: string) {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(''), 1200);
  }

  return (
    <div className="rounded-lg border border-border px-4 py-4">
      <p className="text-sm font-semibold m-0 text-center">{title}</p>
      <p className="text-lg font-semibold text-mono m-0 mt-1 text-center">{amountLabel}</p>
      <p className="m-0 mt-3 flex items-center justify-center gap-2 text-sm font-medium">
        <BankMark id={bankId} />
        {bank}
      </p>
      {billerCode ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground m-0">{billerLabel}</p>
            <p className="text-base font-semibold text-mono m-0">{billerCode}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => copy(billerCode, 'biller')}>
            {copied === 'biller' ? copiedLabel : copyLabel}
          </Button>
        </div>
      ) : null}
      <div className="mt-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground m-0">{billerCode ? billKeyLabel : numberLabel}</p>
          <p className="text-base font-semibold text-mono m-0">{number}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => copy(number, 'va')}>
          {copied === 'va' ? copiedLabel : copyLabel}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground m-0 mt-3 text-center">{orderId}</p>
      <p className="text-sm text-muted-foreground m-0 mt-2 text-center">{wait}</p>
    </div>
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
