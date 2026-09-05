'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { useT } from '@/components/i18n/locale-provider';
import { loginUser, persistAuth } from '@/lib/auth-api';
import { AuthSnackbar, friendlyAuthError } from '@/components/auth/auth-snackbar';

type Mode = 'signin' | 'register';

export function AuthShell({ mode }: { mode: Mode }) {
  const router = useRouter();
  const t = useT();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [snack, setSnack] = useState<{ text: string; tone: 'error' | 'success' | 'info' } | null>(
    null,
  );
  const closeSnack = useCallback(() => setSnack(null), []);

  const title = mode === 'signin' ? t('auth.signInTitle') : t('auth.registerTitle');
  const subtitle =
    mode === 'signin' ? t('auth.signInSubtitle') : t('auth.registerSubtitle');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const identifier = String(form.get('identifier') ?? '').trim();
    const password = String(form.get('password') ?? '');
    if (mode === 'signin') {
      setSnack(null);
      setSubmitting(true);
      try {
        const auth = await loginUser({ email: identifier, password });
        persistAuth(auth);
        router.push('/dashboard/otp');
      } catch (err) {
        setSubmitting(false);
        const raw = err instanceof Error ? err.message : t('auth.signInFailed');
        setSnack({
          text: friendlyAuthError(raw, t('auth.backendDown')),
          tone: 'error',
        });
      }
      return;
    }
    setSnack({ text: t('auth.registerReady'), tone: 'info' });
  }

  return (
    <main className="auth-page">
      <section className="auth-form-pane">
        <Link href="/" className="auth-close" aria-label={t('common.backHome')}>
          ×
        </Link>
        <div className="auth-form-wrap">
          <div className="flex items-center justify-between gap-3 mb-4">
            <img src="/logo-orarepot.svg" alt="Ora Repot" className="auth-logo !mb-0" />
            <LanguageSwitcher compact />
          </div>
          <h1>{title}</h1>
          <p>{subtitle}</p>

          <form className="auth-form" onSubmit={onSubmit}>
            {mode === 'register' && (
              <label>
                {t('auth.fullName')}
                <input required name="name" placeholder={t('auth.fullNamePh')} />
              </label>
            )}
            <label>
              {t('auth.identifier')}
              <input required name="identifier" placeholder={t('auth.identifierPh')} />
            </label>
            <label>
              {t('auth.password')}
              <span className="password-field">
                <input
                  required
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={t('auth.showPassword')}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
            </label>
            {mode === 'register' && (
              <label>
                {t('auth.confirmPassword')}
                <input required name="confirm" type="password" placeholder="••••••••" minLength={6} />
              </label>
            )}

            {mode === 'signin' && (
              <div className="auth-row">
                <label className="remember">
                  <input type="checkbox" name="remember" />
                  <span>{t('auth.remember')}</span>
                </label>
                <button type="button" className="linkish">
                  {t('auth.forgot')}
                </button>
              </div>
            )}

            <button
              type="submit"
              className={`auth-submit${submitting ? ' is-loading' : ''}`}
              disabled={submitting}
              aria-busy={submitting}
            >
              {submitting ? (
                <>
                  <span className="auth-btn-spinner" aria-hidden="true" />
                  <span className="auth-btn-label">{t('auth.signingIn')}</span>
                </>
              ) : (
                <>
                  {mode === 'signin' ? t('auth.submitSignIn') : t('auth.submitRegister')}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="auth-divider">
            <span>{t('auth.orContinue')}</span>
          </div>

          <button
            type="button"
            className="google-btn"
            onClick={() => setSnack({ text: t('auth.googleReady'), tone: 'info' })}
          >
            <GoogleMark />
            Google
          </button>

          <p className="auth-switch">
            {mode === 'signin' ? (
              <>
                {t('auth.noAccount')}{' '}
                <Link href="/register/diorarepot">{t('common.signUp')}</Link>
              </>
            ) : (
              <>
                {t('auth.hasAccount')} <Link href="/sign-in">{t('common.signIn')}</Link>
              </>
            )}
          </p>
        </div>
      </section>

      <aside className="auth-visual" aria-hidden="true">
        <div className="auth-visual-glow" />
        <div className="auth-visual-copy">
          <p className="eyebrow">ORAREPOT</p>
          <h2>{t('auth.visualTitle')}</h2>
          <ul>
            <li>{t('auth.visual1')}</li>
            <li>{t('auth.visual2')}</li>
            <li>{t('auth.visual3')}</li>
          </ul>
        </div>
        <div className="auth-chat-preview">
          <div className="bubble in">{t('auth.chatIn')}</div>
          <div className="bubble out">{t('auth.chatOut')}</div>
        </div>
      </aside>
      <AuthSnackbar
        open={!!snack}
        message={snack?.text ?? ''}
        tone={snack?.tone}
        onClose={closeSnack}
      />
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M9 7.2v3.5h4.9c-.2 1.1-1.5 3.3-4.9 3.3A5.4 5.4 0 1 1 9 3.6c1.5 0 2.6.7 3.2 1.2l2.2-2.1A8.4 8.4 0 1 0 9 17.3c4.9 0 8.1-3.4 8.1-8.2 0-.6-.1-1-.2-1.5H9z"
      />
    </svg>
  );
}
