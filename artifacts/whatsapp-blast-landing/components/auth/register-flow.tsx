'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, ShieldCheck, Smartphone } from 'lucide-react';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { useT } from '@/components/i18n/locale-provider';
import { persistAuth, registerUser } from '@/lib/auth-api';
import { AuthSnackbar, friendlyAuthError } from '@/components/auth/auth-snackbar';

const FREE_TRIAL_KEY = 'orarepot.subscription';

export function RegisterFlow() {
  const router = useRouter();
  const t = useT();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [snack, setSnack] = useState<{ text: string; tone: 'error' | 'success' | 'info' } | null>(
    null,
  );
  const closeSnack = useCallback(() => setSnack(null), []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSnack(null);
    setSubmitting(true);
    try {
      const auth = await registerUser({
        fullName: name,
        email,
        password,
        phone,
      });
      persistAuth(auth);

      const trialEnds = new Date();
      trialEnds.setDate(trialEnds.getDate() + 14);
      localStorage.setItem(
        FREE_TRIAL_KEY,
        JSON.stringify({
          status: 'free_trial',
          plan: 'trial',
          name: auth.user.full_name,
          email: auth.user.email,
          phone: auth.user.phone_e164,
          userId: auth.user.id,
          trialEndsAt: trialEnds.toISOString(),
          createdAt: new Date().toISOString(),
        }),
      );
      router.push('/dashboard');
    } catch (err) {
      const raw = err instanceof Error ? err.message : t('auth.registerFailed');
      setSnack({
        text: friendlyAuthError(raw, t('auth.backendDown')),
        tone: 'error',
      });
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
          <p className="eyebrow">{t('auth.regEyebrow')}</p>
          <h1>{t('auth.regTitle')}</h1>
          <p>{t('auth.regLead')}</p>
          <ul className="reg-flow-points">
            <li>
              <Smartphone size={16} /> {t('auth.regPoint1')}
            </li>
            <li>
              <ShieldCheck size={16} /> {t('auth.regPoint2')}
            </li>
            <li>
              <Check size={16} /> {t('auth.regPoint3')}
            </li>
          </ul>
        </aside>

        <section className="reg-flow-main">
          <Link href="/" className="auth-close" aria-label={t('common.backHome')}>
            ×
          </Link>

          <h2>{t('auth.regFormTitle')}</h2>
          <p className="reg-lead">{t('auth.regFormLead')}</p>

          <form className="auth-form reg-form" onSubmit={onSubmit}>
            <label>
              {t('auth.regBizName')}
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('auth.regBizPh')}
              />
            </label>
            <label>
              {t('auth.regEmail')}
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.identifierPh')}
              />
            </label>
            <label>
              {t('auth.regPhone')}
              <input
                required
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('auth.regPhonePh')}
              />
            </label>
            <label>
              {t('auth.password')}
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
                  <span className="auth-btn-label">{t('auth.regCreating')}</span>
                </>
              ) : (
                <>
                  {t('auth.submitRegister')}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

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
