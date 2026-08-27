'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, CircleAlert, CircleCheck } from 'lucide-react';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { useT } from '@/components/i18n/locale-provider';
import {
  completePaySession,
  formatIdr,
  getSessionByOrderId,
  type PaySession,
} from '@/lib/billing';

export function PayResultPage({ kind }: { kind: 'finish' | 'error' }) {
  const t = useT();
  const params = useSearchParams();
  const orderId = params.get('order_id') ?? params.get('orderId') ?? '';
  const [session, setSession] = useState<PaySession | null | undefined>(undefined);

  useEffect(() => {
    if (!orderId) {
      setSession(null);
      return;
    }
    if (kind === 'finish') {
      completePaySession(orderId);
    }
    setSession(getSessionByOrderId(orderId) ?? null);
  }, [kind, orderId]);

  const ok = kind === 'finish';
  const Icon = ok ? CircleCheck : CircleAlert;

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
          <p className="eyebrow">
            {ok ? t('billing.finishEyebrow') : t('billing.errorEyebrow')}
          </p>
          <h1>{ok ? t('billing.finishTitle') : t('billing.errorTitle')}</h1>
          <p>{ok ? t('billing.finishLead') : t('billing.errorLead')}</p>
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
            <Icon size={28} />
          </div>
          <h2>{ok ? t('billing.finishTitle') : t('billing.errorTitle')}</h2>
          <p className="reg-lead">
            {ok ? t('billing.finishLead') : t('billing.errorLead')}
          </p>

          {session ? (
            <div className="pay-detail-card">
              <div className="pay-copy-row">
                <div>
                  <span>{t('billing.reference')}</span>
                  <strong>{session.id}</strong>
                </div>
              </div>
              <div className="pay-copy-row">
                <div>
                  <span>{t('billing.payAmount')}</span>
                  <strong>{formatIdr(session.amount)}</strong>
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
              {ok ? t('billing.finishCta') : t('billing.errorCta')}{' '}
              <ArrowRight size={16} />
            </Link>
            {!ok && orderId ? (
              <Link href={`/pay/${orderId}`} className="button-ghost">
                {t('billing.retryPay')}
              </Link>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
