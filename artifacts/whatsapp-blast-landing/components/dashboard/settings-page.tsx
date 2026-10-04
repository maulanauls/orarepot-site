'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Download,
  FileSearch,
  Gift,
  Palette,
  Plus,
  Shield,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { DashboardShell } from '@/components/dashboard/shell';
import { useT } from '@/components/i18n/locale-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  exportAccountArchive,
  getAccountSettings,
  saveAccountSettings,
  type AccountAppearance,
  type AccountProfile,
  type SettingsTab,
} from '@/lib/account-settings';
import { UserAvatar } from '@/components/user-avatar';
import { getStoredUser, persistSession, getToken, clearSession } from '@/lib/session';
import { fetchIpAllowlist, patchMe, saveIpAllowlist } from '@/lib/orarepot-api';
import { cn } from '@/lib/utils';

const TABS: {
  id: SettingsTab;
  icon: typeof UserRound;
  labelKey: string;
}[] = [
  { id: 'profile', icon: UserRound, labelKey: 'settingsPage.navProfile' },
  { id: 'appearance', icon: Palette, labelKey: 'settingsPage.navAppearance' },
  { id: 'ipAllowlist', icon: Shield, labelKey: 'settingsPage.navIpAllowlist' },
  { id: 'privacy', icon: ShieldCheck, labelKey: 'settingsPage.navPrivacy' },
  { id: 'audit', icon: FileSearch, labelKey: 'settingsPage.navAudit' },
  { id: 'affiliate', icon: Gift, labelKey: 'settingsPage.navAffiliate' },
];

export function SettingsPage() {
  const t = useT();
  const router = useRouter();
  const { setTheme } = useTheme();
  const [tab, setTab] = useState<SettingsTab>('profile');
  const [profile, setProfile] = useState<AccountProfile>(
    getAccountSettings().profile,
  );
  const [appearance, setAppearance] = useState<AccountAppearance>(
    getAccountSettings().appearance,
  );
  const [affiliateEnabled, setAffiliateEnabled] = useState(false);
  const [emailLocked, setEmailLocked] = useState(true);
  const [saved, setSaved] = useState('');
  const [ready, setReady] = useState(false);
  const [ipRows, setIpRows] = useState<string[]>(['']);
  const [ipError, setIpError] = useState('');
  const [ipSaving, setIpSaving] = useState(false);

  useEffect(() => {
    const stored = getAccountSettings();
    const user = getStoredUser();
    setProfile({
      ...stored.profile,
      name: user?.full_name || stored.profile.name,
      email: user?.email || stored.profile.email,
    });
    setAppearance(stored.appearance);
    setAffiliateEnabled(stored.affiliateEnabled);
    setTheme(stored.appearance.theme);
    setReady(true);
  }, []);

  useEffect(() => {
    if (tab !== 'ipAllowlist') return;
    let cancelled = false;
    void fetchIpAllowlist()
      .then((ips) => {
        if (!cancelled) {
          setIpRows(ips.length ? ips : ['']);
          setIpError('');
        }
      })
      .catch(() => {
        if (!cancelled) setIpRows(['']);
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  function persist(next: {
    profile?: AccountProfile;
    appearance?: AccountAppearance;
    affiliateEnabled?: boolean;
  }) {
    const current = getAccountSettings();
    const merged = {
      profile: next.profile ?? current.profile,
      appearance: next.appearance ?? current.appearance,
      affiliateEnabled: next.affiliateEnabled ?? current.affiliateEnabled,
    };
    saveAccountSettings(merged);
    setSaved(t('settingsPage.saved'));
    window.setTimeout(() => setSaved(''), 1600);
  }

  async function onUpdateProfile() {
    persist({ profile });
    try {
      const user = await patchMe(profile.name);
      const token = getToken();
      if (token) persistSession({ token, user });
    } catch {
      /* local save still applied */
    }
  }

  function onUpdateAppearance() {
    setTheme(appearance.theme);
    persist({ appearance });
  }

  function onDownload() {
    const blob = new Blob([JSON.stringify(exportAccountArchive(), null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'orarepot-account.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  function onDeleteAccount() {
    if (!window.confirm(t('settingsPage.deleteConfirm'))) return;
    localStorage.removeItem('orarepot.account.settings');
    clearSession();
    router.push('/sign-in');
  }

  async function onSaveIpAllowlist() {
    const ips = ipRows.map((ip) => ip.trim()).filter(Boolean);
    setIpSaving(true);
    setIpError('');
    try {
      const savedIps = await saveIpAllowlist(ips);
      setIpRows(savedIps.length ? savedIps : ['']);
      setSaved(t('settingsPage.ipSaved'));
      window.setTimeout(() => setSaved(''), 1600);
    } catch (err) {
      setIpError(err instanceof Error ? err.message : t('settingsPage.ipError'));
    } finally {
      setIpSaving(false);
    }
  }

  const heading =
    tab === 'profile'
      ? t('settingsPage.profileTitle')
      : tab === 'appearance'
        ? t('settingsPage.appearanceTitle')
        : tab === 'ipAllowlist'
          ? t('settingsPage.ipTitle')
          : tab === 'privacy'
            ? t('settingsPage.privacyTitle')
            : tab === 'audit'
              ? t('settingsPage.auditTitle')
              : t('settingsPage.affiliateTitle');

  const lead =
    tab === 'profile'
      ? t('settingsPage.profileLead')
      : tab === 'appearance'
        ? t('settingsPage.appearanceLead')
        : tab === 'ipAllowlist'
          ? t('settingsPage.ipLead')
          : tab === 'privacy'
            ? t('settingsPage.privacyLead')
            : tab === 'audit'
              ? t('settingsPage.auditLead')
              : t('settingsPage.affiliateLead');

  if (!ready) {
    return (
      <DashboardShell title={t('menu.settings')} subtitle={t('settingsPage.subtitle')}>
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title={t('menu.settings')} subtitle={t('settingsPage.subtitle')}>
      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)] items-start">
        <nav className="flex flex-col gap-1">
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-start transition-colors',
                  active
                    ? 'bg-muted font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                <Icon className="size-4 shrink-0" />
                {t(item.labelKey)}
              </button>
            );
          })}
        </nav>

        <section className="min-w-0">
          <div className="pb-5 mb-6 border-b border-border">
            <h2 className="text-lg font-semibold text-mono m-0">{heading}</h2>
            <p className="text-sm text-muted-foreground m-0 mt-1">{lead}</p>
          </div>

          {tab === 'profile' ? (
            <div className="max-w-xl space-y-6">
              <div className="flex items-center gap-3">
                <UserAvatar
                  name={profile.name}
                  imageUrl={profile.imageUrl}
                  sizeClassName="size-14"
                  className="text-lg border border-border"
                />
                <p className="text-sm text-muted-foreground m-0">
                  {t('settingsPage.imageHint')}
                </p>
              </div>
              <Field
                id="acct-name"
                label={t('settingsPage.name')}
                hint={t('settingsPage.nameHint')}
              >
                <Input
                  id="acct-name"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                />
              </Field>
              <Field
                id="acct-email"
                label={t('settingsPage.email')}
                hint={t('settingsPage.emailHint')}
              >
                <div className="flex gap-2">
                  <Input
                    id="acct-email"
                    type="email"
                    value={profile.email}
                    readOnly={emailLocked}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEmailLocked((v) => !v)}
                  >
                    {t('settingsPage.changeEmail')}
                  </Button>
                </div>
              </Field>
              <Field
                id="acct-image"
                label={t('settingsPage.image')}
                hint={t('settingsPage.imageHint')}
              >
                <Input
                  id="acct-image"
                  value={profile.imageUrl}
                  onChange={(e) =>
                    setProfile({ ...profile, imageUrl: e.target.value })
                  }
                />
              </Field>
              <Button onClick={onUpdateProfile}>{t('settingsPage.updateProfile')}</Button>
              {saved ? <p className="text-sm text-primary m-0">{saved}</p> : null}
            </div>
          ) : null}

          {tab === 'appearance' ? (
            <div className="max-w-xl space-y-6">
              <Field id="acct-font" label={t('settingsPage.font')} hint={t('settingsPage.fontHint')}>
                <Input id="acct-font" value="Poppins" readOnly />
              </Field>
              <div className="space-y-2">
                <Label>{t('settingsPage.theme')}</Label>
                <p className="text-xs text-muted-foreground m-0">{t('settingsPage.themeHint')}</p>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <ThemeCard
                    label={t('settingsPage.themeLight')}
                    theme="light"
                    selected={appearance.theme === 'light'}
                    onSelect={() => setAppearance({ ...appearance, theme: 'light' })}
                  />
                  <ThemeCard
                    label={t('settingsPage.themeDark')}
                    theme="dark"
                    selected={appearance.theme === 'dark'}
                    onSelect={() => setAppearance({ ...appearance, theme: 'dark' })}
                  />
                </div>
              </div>
              <Button onClick={onUpdateAppearance}>
                {t('settingsPage.updatePrefs')}
              </Button>
              {saved ? <p className="text-sm text-primary m-0">{saved}</p> : null}
            </div>
          ) : null}

          {tab === 'ipAllowlist' ? (
            <div className="max-w-xl space-y-4">
              {ipRows.every((row) => !row.trim()) ? (
                <p className="text-sm text-muted-foreground m-0">{t('settingsPage.ipEmpty')}</p>
              ) : null}
              <div className="space-y-2">
                {ipRows.map((value, index) => (
                  <div key={`ip-${index}`} className="flex items-center gap-2">
                    <Input
                      value={value}
                      onChange={(e) => {
                        const next = [...ipRows];
                        next[index] = e.target.value;
                        setIpRows(next);
                      }}
                      placeholder={t('settingsPage.ipHint')}
                      className="font-mono text-sm"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      mode="icon"
                      disabled={ipRows.length <= 1}
                      onClick={() => {
                        setIpRows((current) =>
                          current.length <= 1
                            ? ['']
                            : current.filter((_, i) => i !== index),
                        );
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground m-0">{t('settingsPage.ipHint')}</p>
              {ipError ? <p className="text-sm text-destructive m-0">{ipError}</p> : null}
              {saved && tab === 'ipAllowlist' ? (
                <p className="text-sm text-primary m-0">{saved}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIpRows((current) => [...current, ''])}
                >
                  <Plus /> {t('settingsPage.ipAdd')}
                </Button>
                <Button type="button" onClick={onSaveIpAllowlist} disabled={ipSaving}>
                  {t('common.save')}
                </Button>
              </div>
            </div>
          ) : null}

          {tab === 'privacy' ? (
            <div className="max-w-2xl space-y-8">
              <div className="space-y-3">
                <h3 className="text-base font-semibold m-0">{t('settingsPage.downloadTitle')}</h3>
                <p className="text-sm text-muted-foreground m-0">{t('settingsPage.downloadBody')}</p>
                <Button variant="outline" onClick={onDownload}>
                  <Download /> {t('settingsPage.downloadCta')}
                </Button>
              </div>
              <div className="rounded-xl border border-destructive/40 px-5 py-4 space-y-3">
                <p className="text-sm font-semibold text-destructive m-0 inline-flex items-center gap-2">
                  <Trash2 className="size-4" />
                  {t('settingsPage.deleteTitle')}
                </p>
                <p className="text-sm text-muted-foreground m-0">{t('settingsPage.deleteBody')}</p>
                <Button variant="destructive" onClick={onDeleteAccount}>
                  {t('settingsPage.deleteCta')}
                </Button>
              </div>
            </div>
          ) : null}

          {tab === 'audit' ? (
            <p className="text-sm text-muted-foreground m-0">{t('settingsPage.auditEmpty')}</p>
          ) : null}

          {tab === 'affiliate' ? (
            <div className="max-w-2xl rounded-xl border border-border px-5 py-5 space-y-3">
              <p className="text-sm font-semibold m-0 inline-flex items-center gap-2">
                <Gift className="size-4" />
                {affiliateEnabled
                  ? t('settingsPage.affiliateOnTitle')
                  : t('settingsPage.affiliateOffTitle')}
              </p>
              <p className="text-sm text-muted-foreground m-0">
                {affiliateEnabled
                  ? t('settingsPage.affiliateOnBody')
                  : t('settingsPage.affiliateOffBody')}
              </p>
              {!affiliateEnabled ? (
                <Button
                  onClick={() => {
                    setAffiliateEnabled(true);
                    persist({ affiliateEnabled: true });
                  }}
                >
                  {t('settingsPage.affiliateCta')}
                </Button>
              ) : (
                <p className="text-sm font-medium m-0">orarepot.com/r/merchant</p>
              )}
            </div>
          ) : null}
        </section>
      </div>
    </DashboardShell>
  );
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      <p className="text-xs text-muted-foreground m-0">{hint}</p>
    </div>
  );
}

function ThemeCard({
  label,
  theme,
  selected,
  onSelect,
}: {
  label: string;
  theme: 'light' | 'dark';
  selected: boolean;
  onSelect: () => void;
}) {
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'rounded-xl border p-3 text-start transition-colors',
        selected ? 'border-primary' : 'border-border hover:border-muted-foreground/40',
      )}
    >
      <div
        className={cn(
          'mb-3 rounded-md border overflow-hidden h-16',
          dark ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-200',
        )}
      >
        <div className={cn('h-4 border-b', dark ? 'border-zinc-700 bg-zinc-800' : 'border-zinc-200 bg-zinc-50')} />
        <div className="flex h-[calc(100%-1rem)]">
          <div className={cn('w-6', dark ? 'bg-zinc-800' : 'bg-zinc-100')} />
          <div className="flex-1 p-2 space-y-1">
            <div className={cn('h-1.5 w-10 rounded', dark ? 'bg-zinc-600' : 'bg-zinc-300')} />
            <div className={cn('h-1.5 w-14 rounded', dark ? 'bg-zinc-700' : 'bg-zinc-200')} />
          </div>
        </div>
      </div>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
