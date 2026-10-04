'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { useT } from '@/components/i18n/locale-provider';
import { acceptInviteApi, declineInviteApi } from '@/lib/orarepot-api';
import { savePendingInvite, takePendingInvite } from '@/lib/pending-invite';
import { getStoredUser, getToken, persistSession } from '@/lib/session';
import { AuthSnackbar } from '@/components/auth/auth-snackbar';

type Status = 'ready' | 'accepting' | 'declining' | 'ok' | 'declined' | 'error';

export function InviteAcceptPage() {
  const t = useT();
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const id = params.id ?? '';
  const token = search.get('token') ?? '';
  const action = search.get('action');
  const [status, setStatus] = useState<Status>('ready');
  const [error, setError] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);

  const runDecline = useCallback(async () => {
    if (!id || !token) return;
    setStatus('declining');
    setError('');
    try {
      await declineInviteApi(id, token);
      takePendingInvite();
      setStatus('declined');
    } catch (err) {
      setStatus('error');
      const message = err instanceof Error ? err.message : t('auth.inviteInvalid');
      setError(message.toLowerCase().includes('diundang') ? t('auth.inviteWrongEmail') : message);
    }
  }, [id, token, t]);

  useEffect(() => {
    setLoggedIn(!!getToken());
    if (!id || !token) {
      setStatus('error');
      setError(t('auth.inviteInvalid'));
      return;
    }
    savePendingInvite({ id, token });
    if (action === 'decline') {
      void runDecline();
    }
  }, [id, token, action, t, runDecline]);

  async function onAccept() {
    if (!id || !token) return;
    if (!getToken()) {
      savePendingInvite({ id, token });
      window.location.href = '/sign-in';
      return;
    }
    setStatus('accepting');
    setError('');
    try {
      const accepted = await acceptInviteApi(id, token);
      const sessionToken = getToken();
      const user = getStoredUser();
      if (sessionToken && user && accepted.merchantId) {
        persistSession({ token: sessionToken, user, merchantId: accepted.merchantId });
      }
      takePendingInvite();
      setStatus('ok');
      window.setTimeout(() => {
        window.location.href = '/dashboard';
      }, 800);
    } catch (err) {
      setStatus('error');
      const message = err instanceof Error ? err.message : t('auth.inviteInvalid');
      setError(message.toLowerCase().includes('diundang') ? t('auth.inviteWrongEmail') : message);
    }
  }

  const busy = status === 'accepting' || status === 'declining';
  const showChooser = status === 'ready' || busy;

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
          {status === 'ok' ? <p className="reg-lead">{t('auth.inviteAccepted')}</p> : null}
          {status === 'declined' ? <p className="reg-lead">{t('auth.inviteDeclined')}</p> : null}
          {status === 'error' ? <p className="reg-lead">{error}</p> : null}
          {showChooser ? (
            <>
              <p className="reg-lead">
                {loggedIn ? t('auth.inviteChoose') : t('auth.inviteNeedAuth')}
              </p>
              <div className="reg-actions invite-actions">
                {loggedIn ? (
                  <button type="button" className="auth-submit" onClick={onAccept} disabled={busy}>
                    {status === 'accepting' ? t('common.loading') : t('auth.inviteAccept')}
                    <ArrowRight size={16} />
                  </button>
                ) : (
                  <>
                    <Link
                      href="/sign-in"
                      className="auth-submit"
                      onClick={() => savePendingInvite({ id, token })}
                    >
                      {t('common.signIn')} <ArrowRight size={16} />
                    </Link>
                    <Link
                      href="/register/diorarepot"
                      className="button-ghost invite-signup"
                      onClick={() => savePendingInvite({ id, token })}
                    >
                      {t('common.signUp')}
                    </Link>
                  </>
                )}
                <button type="button" className="button-ghost invite-decline" onClick={runDecline} disabled={busy}>
                  {status === 'declining' ? t('common.loading') : t('auth.inviteDecline')}
                </button>
              </div>
            </>
          ) : null}
        </section>
      </div>
      <AuthSnackbar open={!!error} message={error} tone="error" onClose={() => setError('')} />
    </main>
  );
}
