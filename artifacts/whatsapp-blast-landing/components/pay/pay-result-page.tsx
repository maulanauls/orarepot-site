'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, CircleAlert, CircleCheck, LoaderCircle } from 'lucide-react';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { useT } from '@/components/i18n/locale-provider';
import { formatIdr } from '@/lib/billing';
import { fetchPayment, type PaymentRow } from '@/lib/orarepot-api';

type ViewStatus = 'loading' | 'pending' | 'paid' | 'failed';

function viewFromPayment(status: string | undefined, kind: 'finish' | 'error'): ViewStatus {
  if (status === 'paid') return 'paid';
  if (status === 'expired' || status === 'failed' || status === 'canceled') return 'failed';
  if (status === 'pending') return 'pending';
  return kind === 'error' ? 'failed' : 'pending';
}

export function PayResultPage({ kind }: { kind: 'finish' | 'error' }) {
  const t = useT();
  const params = useSearchParams();
  const orderId = params.get('order_id') ?? params.get('orderId') ?? '';
  const [payment, setPayment] = useState<PaymentRow | null>(null);
  const [view, setView] = useState<ViewStatus>('loading');

  useEffect(() => {
    let cancelled = false;
    let ticks = 0;
    let timer: number | undefined;

    async function poll() {
      if (!orderId) {
        setView(kind === 'error' ? 'failed' : 'pending');
        return false;
      }
      try {
        const row = await fetchPayment(orderId);
        if (cancelled) return false;
        setPayment(row);
        const next = viewFromPayment(row.status, kind);
        setView(next);
        return next === 'pending';
      } catch {
        if (!cancelled) {
          setView(kind === 'error' ? 'failed' : 'pending');
        }
        return !cancelled;
      }
    }

    void poll().then((keepGoing) => {
      if (!keepGoing || cancelled) return;
      timer = window.setInterval(() => {
        ticks += 1;
        if (ticks > 60) {
          if (timer) window.clearInterval(timer);
          return;
        }
        void poll().then((again) => {
          if (!again && timer) window.clearInterval(timer);
        });
      }, 2500);
    });

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, [kind, orderId]);

  const ok = view === 'paid';
  const pending = view === 'pending' || view === 'loading';
  const Icon = ok ? CircleCheck : pending ? LoaderCircle : CircleAlert;
  const eyebrow = ok
    ? t('billing.finishEyebrow')
    : pending
      ? t('billing.pendingEyebrow')
      : t('billing.errorEyebrow');
  const title = ok
    ? t('billing.finishTitle')
    : pending
      ? t('billing.pendingTitle')
      : t('billing.errorTitle');
  const lead = ok
    ? t('billing.finishLead')
    : pending
      ? t('billing.pendingLead')
      : t('billing.errorLead');

  return (
    <main className="reg-flow-page">
      <div className="reg-flow-shell">
        <aside className="reg-flow-aside">
          <div className="flex items-center justify-between gap-3 mb-2">
            <Link href="/dashboard/billing" className="reg-flow-logo">
              <img src="/logo-orarepot.svg" alt="Ora Repot" />
            </Link>
            <LanguageSwitcher compact className="lang-switch-nav" />
          </div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{lead}</p>
        </aside>

        <section className="reg-flow-main">
          <Link
            href="/dashboard/billing"
            className="auth-close"
            aria-label={t('billing.backBilling')}
          >
            ×
          </Link>
          <div className="pay-result-icon" data-ok={ok ? 'true' : 'false'}>
            <Icon size={28} className={pending ? 'animate-spin' : undefined} />
          </div>
          <h2>{title}</h2>
          <p className="reg-lead">{lead}</p>

          {payment ? (
            <div className="pay-detail-card">
              <div className="pay-copy-row">
                <div>
                  <span>{t('billing.reference')}</span>
                  <strong>{payment.order_id}</strong>
                </div>
              </div>
              <div className="pay-copy-row">
                <div>
                  <span>{t('billing.payAmount')}</span>
                  <strong>{formatIdr(payment.amount_idr)}</strong>
                </div>
              </div>
              <div className="pay-copy-row">
                <div>
                  <span>{t('billing.colStatus')}</span>
                  <strong>
                    {payment.status === 'paid'
                      ? t('billing.paid')
                      : payment.status === 'pending'
                        ? t('billing.pending')
                        : t('billing.errorTitle')}
                  </strong>
                </div>
              </div>
            </div>
          ) : orderId ? (
            <div className="pay-detail-card">
              <div className="pay-copy-row">
                <div>
                  <span>{t('billing.reference')}</span>
                  <strong>{orderId}</strong>
                </div>
              </div>
            </div>
          ) : null}

          <div className="reg-actions">
            <Link href="/dashboard/billing" className="auth-submit">
              {ok
                ? t('billing.finishCta')
                : pending
                  ? t('billing.backBilling')
                  : t('billing.errorCta')}{' '}
              <ArrowRight size={16} />
            </Link>
            {!ok && !pending && orderId ? (
              <Link href="/dashboard/billing" className="button-ghost">
                {t('billing.retryPay')}
              </Link>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
