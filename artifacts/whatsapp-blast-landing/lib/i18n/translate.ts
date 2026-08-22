import type { Messages } from '@/lib/i18n/dictionaries';
import { dictionaries } from '@/lib/i18n/dictionaries';
import type { Locale } from '@/lib/i18n/config';
import { DEFAULT_LOCALE } from '@/lib/i18n/config';

type Vars = Record<string, string | number>;

function lookup(messages: Messages, path: string): string | undefined {
  const parts = path.split('.');
  let cur: string | Messages | undefined = messages;
  for (const part of parts) {
    if (!cur || typeof cur === 'string') return undefined;
    cur = cur[part];
  }
  return typeof cur === 'string' ? cur : undefined;
}

export function translate(
  locale: Locale,
  key: string,
  vars?: Vars,
): string {
  const primary = lookup(dictionaries[locale], key);
  const fallback =
    locale !== DEFAULT_LOCALE
      ? lookup(dictionaries[DEFAULT_LOCALE], key)
      : undefined;
  let text = primary ?? fallback ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return text;
}

export function getMessages(locale: Locale): Messages {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}
