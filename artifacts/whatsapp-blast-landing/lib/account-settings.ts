export type SettingsTab =
  | 'profile'
  | 'appearance'
  | 'privacy'
  | 'audit'
  | 'affiliate';

export type AccountProfile = {
  name: string;
  email: string;
  imageUrl: string;
};

export type AccountAppearance = {
  font: 'poppins';
  theme: 'light' | 'dark';
};

export type AccountSettings = {
  profile: AccountProfile;
  appearance: AccountAppearance;
  affiliateEnabled: boolean;
};

const STORAGE_KEY = 'orarepot.account.settings';

const DEFAULT_SETTINGS: AccountSettings = {
  profile: {
    name: 'Ora Repot Merchant',
    email: 'merchant@orarepot.com',
    imageUrl: '/media/avatars/300-2.png',
  },
  appearance: {
    font: 'poppins',
    theme: 'light',
  },
  affiliateEnabled: false,
};

function readSettings(): AccountSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AccountSettings>;
    return {
      profile: { ...DEFAULT_SETTINGS.profile, ...parsed.profile },
      appearance: {
        ...DEFAULT_SETTINGS.appearance,
        ...parsed.appearance,
        font: 'poppins',
      },
      affiliateEnabled: parsed.affiliateEnabled ?? false,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function getAccountSettings(): AccountSettings {
  return readSettings();
}

export function saveAccountSettings(next: AccountSettings) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function exportAccountArchive() {
  return {
    exportedAt: new Date().toISOString(),
    profile: readSettings().profile,
    appearance: readSettings().appearance,
    affiliateEnabled: readSettings().affiliateEnabled,
  };
}
