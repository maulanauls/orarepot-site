'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Building2, CheckCircle2, Copy, CreditCard, QrCode } from 'lucide-react';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { useLocale } from '@/components/i18n/locale-provider';
import { formatIdr, getSession, type PaySession } from '@/lib/billing';
import { midtransLanguage } from '@/lib/midtrans';
import { loadMidtransSnap } from '@/lib/midtrans-snap';

export function CheckoutPage({ sessionId }: { sessionId: string }) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const snapLanguage = midtransLanguage(locale);
  const [session, setSession] = useState<PaySession | null | undefined>(undefined);
  const [copied, setCopied] = useState('');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const [pendingNote, setPendingNote] = useState(false);

  useEffect(() => {
    setSession(getSession(sessionId) ?? null);
  }, [sessionId]);

  async function copy(value: string, key: string) {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(''), 1200);
  }

  async function onContinue() {
    if (!session || session.status !== 'pending') return;
    setPaying(true);
    setPayError('');
    setPendingNote(false);

    try {
      const snap = await loadMidtransSnap();
      const res = await fetch('/api/pay/snap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: session.id,
          amount: session.amount,
          customerName: session.customerName,
          customerRef: session.customerRef,
          language: snapLanguage,
        }),
      });
      const data = (await res.json()) as {
        token?: string;
        orderId?: string;
        error?: string;
      };
      if (!res.ok || !data.token) {
        throw new Error(data.error || t('billing.snapError'));
      }

      const orderId = data.orderId || session.id;
      snap.pay(data.token, {
        language: snapLanguage,
        onSuccess: () => {
          router.push(`/pay/finish?order_id=${encodeURIComponent(orderId)}`);
        },
        onPending: () => {
          setPaying(false);
          setPendingNote(true);
        },
        onError: () => {
          router.push(`/pay/error?order_id=${encodeURIComponent(orderId)}`);
        },
        onClose: () => {
          setPaying(false);
        },
      });
    } catch (error) {
      setPaying(false);
      setPayError(
        error instanceof Error && error.message
          ? error.message
          : t('billing.snapError'),
      );
    }
  }

  if (session === undefined) {
    return (
      <main className="reg-flow-page">
        <p className="reg-lead" style={{ textAlign: 'center' }}>
          {t('common.loading')}
        </p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="reg-flow-page">
        <div className="reg-done" style={{ margin: 'auto' }}>
          <h2>{t('billing.sessionMissing')}</h2>
          <p>{t('billing.sessionMissingBody')}</p>
          <Link href="/dashboard/billing" className="auth-submit">
            {t('billing.backBilling')} <ArrowRight size={16} />
          </Link>
        </div>
      </main>
    );
  }

  const expiry = new Date(session.expiresAt).toLocaleString(
    locale === 'en' ? 'en-GB' : 'id-ID',
    {
      dateStyle: 'medium',
      timeStyle: 'medium',
    },
  );

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
          <p className="eyebrow">{t('billing.payEyebrow')}</p>
          <h1>{formatIdr(session.amount)}</h1>
          <p>{t('billing.payLead')}</p>
          <ul className="reg-flow-points">
            <li>
              <QrCode size={16} /> QRIS
            </li>
            <li>
              <Building2 size={16} /> Virtual Account
            </li>
            <li>
              <CreditCard size={16} /> {t('billing.snapMethods')}
            </li>
          </ul>
          <p className="pay-aside-note">{t('billing.snapMethodsDesc')}</p>
        </aside>

        <section className="reg-flow-main">
          <Link
            href="/dashboard/billing"
            className="auth-close"
            aria-label={t('billing.backBilling')}
          >
            ×
          </Link>
          <h2>{t('billing.selectMethod')}</h2>
          <p className="reg-lead">{t('billing.selectMethodDesc')}</p>

          <div className="pay-detail-card">
            <CopyRow
              label={t('billing.reference')}
              value={session.id}
              copied={copied === 'ref'}
              onCopy={() => copy(session.id, 'ref')}
            />
            <CopyRow
              label={t('billing.customerName')}
              value={session.customerName}
              copied={copied === 'name'}
              onCopy={() => copy(session.customerName, 'name')}
            />
            <CopyRow
              label={t('billing.customerRef')}
              value={session.customerRef}
              copied={copied === 'cref'}
              onCopy={() => copy(session.customerRef, 'cref')}
            />
          </div>

          <div className="reg-pay-summary">
            <div>
              <span>{t('billing.payAmount')}</span>
              <strong>{formatIdr(session.amount)}</strong>
            </div>
            <div>
              <span>{t('billing.payBefore', { time: expiry })}</span>
            </div>
          </div>

          <p className="reg-lead">{t('billing.midtransNote')}</p>
          {pendingNote ? (
            <p className="reg-lead">{t('billing.snapPending')}</p>
          ) : null}
          {payError ? (
            <p className="reg-lead" role="alert">
              {payError}
            </p>
          ) : null}

          <div className="reg-actions">
            <button
              type="button"
              className="auth-submit"
              onClick={onContinue}
              disabled={paying || session.status !== 'pending'}
            >
              {session.status === 'paid'
                ? t('billing.alreadyPaid')
                : paying
                  ? t('billing.openingSnap')
                  : t('billing.continuePay')}{' '}
              <ArrowRight size={16} />
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function CopyRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="pay-copy-row">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <button type="button" onClick={onCopy} aria-label={label}>
        {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}
