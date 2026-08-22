import { products as baseProducts, type Product, type ProductSlug } from '@/content/products';
import type { Locale } from '@/lib/i18n/config';
import { translate } from '@/lib/i18n/translate';

const PRODUCT_KEYS: Record<
  ProductSlug,
  { label: string; short: string; title: string; desc: string }
> = {
  'agentic-ai': {
    label: 'products.agenticAiLabel',
    short: 'products.agenticAiShort',
    title: 'products.agenticAiTitle',
    desc: 'products.agenticAiDesc',
  },
  'waba-messaging': {
    label: 'products.wabaLabel',
    short: 'products.wabaShort',
    title: 'products.wabaTitle',
    desc: 'products.wabaDesc',
  },
  'pulsa-dan-voucher-game': {
    label: 'products.pulsaLabel',
    short: 'products.pulsaShort',
    title: 'products.pulsaTitle',
    desc: 'products.pulsaDesc',
  },
};

export function getLocalizedProducts(locale: Locale): Product[] {
  return baseProducts.map((p) => {
    const keys = PRODUCT_KEYS[p.slug];
    return {
      ...p,
      label: translate(locale, keys.label),
      shortTitle: translate(locale, keys.short),
      title: translate(locale, keys.title),
      description: translate(locale, keys.desc),
      cta: translate(locale, 'common.tryNow'),
    };
  });
}
