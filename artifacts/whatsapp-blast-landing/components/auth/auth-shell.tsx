'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { useT } from '@/components/i18n/locale-provider';
import { loginUser, loginWithGoogle, pendingInviteHref, persistAuth } from '@/lib/auth-api';
import { requestGoogleCode } from '@/lib/google-auth';
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
        router.push(pendingInviteHref() ?? '/dashboard/otp');
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

  async function onGoogle() {
    setSnack(null);
    setSubmitting(true);
    try {
      const code = await requestGoogleCode();
      const auth = await loginWithGoogle(code);
      persistAuth(auth);
      router.push(pendingInviteHref() ?? '/dashboard/otp');
    } catch (err) {
      setSubmitting(false);
      const raw = err instanceof Error ? err.message : t('auth.googleFailed');
      setSnack({
        text: friendlyAuthError(raw, t('auth.backendDown')),
        tone: 'error',
      });
    }
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
                <Link href="/forgot-password" className="linkish">
                  {t('auth.forgot')}
                </Link>
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
            onClick={onGoogle}
            disabled={submitting}
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
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
    </svg>
  );
}
