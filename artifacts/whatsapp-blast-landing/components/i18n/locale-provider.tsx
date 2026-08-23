'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  isLocale,
  type Locale,
} from '@/lib/i18n/config';
import { translate } from '@/lib/i18n/translate';
import { PageLoader } from '@/components/layout/page-loader';

const LOCALE_RELOAD_FLAG = 'orarepot.locale-reload';

type Vars = Record<string, string | number>;

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Vars) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readStoredLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);
  const [showLoader, setShowLoader] = useState(false);

  useEffect(() => {
    setLocaleState(readStoredLocale());
    setReady(true);
    try {
      if (sessionStorage.getItem(LOCALE_RELOAD_FLAG) === '1') {
        sessionStorage.removeItem(LOCALE_RELOAD_FLAG);
        setShowLoader(true);
        const timer = window.setTimeout(() => setShowLoader(false), 720);
        return () => window.clearTimeout(timer);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = locale;
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      /* ignore */
    }
  }, [locale, ready]);

  const setLocale = useCallback((next: Locale) => {
    if (next === locale) return;
    setShowLoader(true);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
      sessionStorage.setItem(LOCALE_RELOAD_FLAG, '1');
    } catch {
      /* ignore */
    }
    window.location.reload();
  }, [locale]);

  const t = useCallback(
    (key: string, vars?: Vars) => translate(locale, key, vars),
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return (
    <LocaleContext.Provider value={value}>
      {showLoader ? <PageLoader /> : null}
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return ctx;
}

export function useT() {
  return useLocale().t;
}
