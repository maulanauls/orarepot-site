'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, ShieldCheck, Smartphone } from 'lucide-react';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { useT } from '@/components/i18n/locale-provider';

const FREE_TRIAL_KEY = 'orarepot.subscription';

export function RegisterFlow() {
  const router = useRouter();
  const t = useT();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const trialEnds = new Date();
    trialEnds.setDate(trialEnds.getDate() + 14);

    try {
      localStorage.setItem(
        FREE_TRIAL_KEY,
        JSON.stringify({
          status: 'free_trial',
          plan: 'trial',
          name,
          email,
          phone,
          trialEndsAt: trialEnds.toISOString(),
          createdAt: new Date().toISOString(),
        }),
      );
    } catch {
      /* ignore */
    }

    window.setTimeout(() => {
      router.push('/dashboard');
    }, 400);
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
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.regPassPh')}
              />
            </label>
            <button type="submit" className="auth-submit" disabled={submitting}>
              {submitting ? t('auth.regCreating') : t('auth.submitRegister')}{' '}
              <ArrowRight size={16} />
            </button>
          </form>

          <p className="auth-switch">
            {t('auth.hasAccount')} <Link href="/sign-in">{t('common.signIn')}</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
