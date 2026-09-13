'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { useT } from '@/components/i18n/locale-provider';
import { acceptInviteApi } from '@/lib/orarepot-api';
import { savePendingInvite } from '@/lib/pending-invite';
import { getToken } from '@/lib/session';
import { AuthSnackbar } from '@/components/auth/auth-snackbar';

export function InviteAcceptPage() {
  const t = useT();
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const id = params.id ?? '';
  const token = search.get('token') ?? '';
  const [status, setStatus] = useState<'loading' | 'need-auth' | 'ok' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id || !token) {
      setStatus('error');
      setError(t('auth.inviteInvalid'));
      return;
    }
    savePendingInvite({ id, token });
    if (!getToken()) {
      setStatus('need-auth');
      return;
    }
    acceptInviteApi(id, token)
      .then(() => {
        sessionStorage.removeItem('orarepot.pendingInvite');
        setStatus('ok');
        window.setTimeout(() => {
          window.location.href = '/dashboard';
        }, 800);
      })
      .catch((err) => {
        setStatus('error');
        setError(err instanceof Error ? err.message : t('auth.inviteInvalid'));
      });
  }, [id, token, t]);

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
          <p className="eyebrow">{t('auth.inviteEyebrow')}</p>
          <h1>{t('auth.inviteTitle')}</h1>
          <p>{t('auth.inviteLead')}</p>
        </aside>
        <section className="reg-flow-main">
          <h2>{t('auth.inviteTitle')}</h2>
          {status === 'loading' ? <p className="reg-lead">{t('common.loading')}</p> : null}
          {status === 'ok' ? <p className="reg-lead">{t('auth.inviteAccepted')}</p> : null}
          {status === 'need-auth' ? (
            <>
              <p className="reg-lead">{t('auth.inviteNeedAuth')}</p>
              <div className="reg-actions">
                <Link href="/sign-in" className="auth-submit">
                  {t('common.signIn')} <ArrowRight size={16} />
                </Link>
                <Link href="/register/diorarepot" className="button-ghost">
                  {t('common.signUp')}
                </Link>
              </div>
            </>
          ) : null}
          {status === 'error' ? <p className="reg-lead">{error}</p> : null}
        </section>
      </div>
      <AuthSnackbar open={!!error} message={error} tone="error" onClose={() => setError('')} />
    </main>
  );
}
