export type Locale = 'id' | 'en';

export const LOCALES: Locale[] = ['id', 'en'];
export const DEFAULT_LOCALE: Locale = 'id';
export const LOCALE_STORAGE_KEY = 'orarepot.locale';

export const LOCALE_LABEL: Record<Locale, string> = {
  id: 'Indonesia',
  en: 'English',
};

export function isLocale(value: unknown): value is Locale {
  return value === 'id' || value === 'en';
}
