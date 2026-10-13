import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

const PAGES: { path: string; priority: number }[] = [
  { path: '/', priority: 1 },
  { path: '/di/orarepot/waba-messaging', priority: 0.9 },
  { path: '/di/orarepot/agentic-ai', priority: 0.8 },
  { path: '/di/orarepot/pulsa-dan-voucher-game', priority: 0.7 },
  { path: '/harga/di/orarepot', priority: 0.8 },
  { path: '/demo/di/orarepot', priority: 0.6 },
  { path: '/docs', priority: 0.7 },
  { path: '/docs/quickstart', priority: 0.6 },
  { path: '/docs/authentication', priority: 0.5 },
  { path: '/docs/otp/send', priority: 0.7 },
  { path: '/docs/webhooks', priority: 0.5 },
  { path: '/docs/errors', priority: 0.4 },
  { path: '/docs/guides/templates', priority: 0.5 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((page) => ({
    url: page.path === '/' ? SITE_URL : `${SITE_URL}${page.path}`,
    changeFrequency: page.priority >= 0.8 ? 'weekly' : 'monthly',
    priority: page.priority,
  }));
}
