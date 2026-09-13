'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { useT } from '@/components/i18n/locale-provider';
import { requestPasswordOtp, resetPasswordWithOtp } from '@/lib/auth-api';
import { AuthSnackbar, friendlyAuthError } from '@/components/auth/auth-snackbar';

type Step = 'request' | 'reset';

export function ForgotPasswordFlow() {
  const router = useRouter();
  const t = useT();
  const [step, setStep] = useState<Step>('request');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [snack, setSnack] = useState<{ text: string; tone: 'error' | 'success' | 'info' } | null>(
    null,
  );
  const closeSnack = useCallback(() => setSnack(null), []);

  async function onRequest(e: FormEvent) {
    e.preventDefault();
    setSnack(null);
    setSubmitting(true);
    try {
      await requestPasswordOtp(identifier);
      setStep('reset');
      setSnack({ text: t('auth.forgotSent'), tone: 'success' });
    } catch (err) {
      const raw = err instanceof Error ? err.message : t('auth.forgotFailed');
      setSnack({
        text: friendlyAuthError(raw, t('auth.backendDown')),
        tone: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function onReset(e: FormEvent) {
    e.preventDefault();
    setSnack(null);
    setSubmitting(true);
    try {
      await resetPasswordWithOtp({ identifier, code, password });
      setSnack({ text: t('auth.forgotDone'), tone: 'success' });
      window.setTimeout(() => router.push('/sign-in'), 900);
    } catch (err) {
      setSubmitting(false);
      const raw = err instanceof Error ? err.message : t('auth.forgotFailed');
      setSnack({
        text: friendlyAuthError(raw, t('auth.backendDown')),
        tone: 'error',
      });
    }
  }

  async function onResend() {
    setSnack(null);
    setSubmitting(true);
    try {
      await requestPasswordOtp(identifier);
      setSnack({ text: t('auth.forgotSent'), tone: 'success' });
    } catch (err) {
      const raw = err instanceof Error ? err.message : t('auth.forgotFailed');
      setSnack({
        text: friendlyAuthError(raw, t('auth.backendDown')),
        tone: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="reg-flow-page">
      <div className="reg-flow-shell">
        <aside className="reg-flow-aside">
          <div className="flex items-center justify-between gap-3 mb-4">
            <Link href="/" className="reg-flow-logo">
              <img src="/logo-orarepot.svg" alt="Ora Repot" />
            </Link>
            <LanguageSwitcher compact />
          </div>
          <p className="eyebrow">{t('auth.forgotEyebrow')}</p>
          <h1>{t('auth.forgotTitle')}</h1>
          <p>{t('auth.forgotLead')}</p>
        </aside>

        <section className="reg-flow-main">
          <Link href="/sign-in" className="auth-close" aria-label={t('common.signIn')}>
            ×
          </Link>
          <h2>{step === 'request' ? t('auth.forgotFormTitle') : t('auth.forgotResetTitle')}</h2>
          <p className="reg-lead">
            {step === 'request' ? t('auth.forgotFormLead') : t('auth.forgotResetLead')}
          </p>

          {step === 'request' ? (
            <form className="auth-form reg-form" onSubmit={onRequest}>
              <label>
                {t('auth.identifier')}
                <input
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={t('auth.identifierPh')}
                />
              </label>
              <button
                type="submit"
                className={`auth-submit${submitting ? ' is-loading' : ''}`}
                disabled={submitting}
                aria-busy={submitting}
              >
                {submitting ? (
                  <>
                    <span className="auth-btn-spinner" aria-hidden="true" />
                    <span className="auth-btn-label">{t('auth.forgotSending')}</span>
                  </>
                ) : (
                  <>
                    {t('auth.forgotSubmit')}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form className="auth-form reg-form" onSubmit={onReset}>
              <label>
                {t('auth.forgotCode')}
                <input
                  required
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  minLength={4}
                  maxLength={8}
                />
              </label>
              <label>
                {t('auth.forgotNewPass')}
                <input
                  required
                  type="password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('auth.regPassPh')}
                />
              </label>
              <button
                type="submit"
                className={`auth-submit${submitting ? ' is-loading' : ''}`}
                disabled={submitting}
                aria-busy={submitting}
              >
                {submitting ? (
                  <>
                    <span className="auth-btn-spinner" aria-hidden="true" />
                    <span className="auth-btn-label">{t('auth.forgotSaving')}</span>
                  </>
                ) : (
                  <>
                    {t('auth.forgotSave')}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
              <button
                type="button"
                className="linkish"
                onClick={() => void onResend()}
                disabled={submitting}
              >
                {t('auth.forgotResend')}
              </button>
            </form>
          )}

          <p className="auth-switch">
            {t('auth.hasAccount')} <Link href="/sign-in">{t('common.signIn')}</Link>
          </p>
        </section>
      </div>
      <AuthSnackbar
        open={!!snack}
        message={snack?.text ?? ''}
        tone={snack?.tone}
        onClose={closeSnack}
      />
    </main>
  );
}
