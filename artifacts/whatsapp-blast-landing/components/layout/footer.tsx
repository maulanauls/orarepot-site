'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { useLocale } from '@/components/i18n/locale-provider';
import { getLocalizedProducts } from '@/lib/i18n/products';

export function Footer() {
  const pathname = usePathname();
  const { locale, t } = useLocale();
  const products = useMemo(() => getLocalizedProducts(locale), [locale]);

  if (
    pathname.startsWith('/sign-in') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/demo') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/admin')
  ) {
    return null;
  }

  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <span className="footer-copy">
          © {new Date().getFullYear()} Ora Repot. {t('footer.tagline')}
        </span>
        <div className="footer-links">
          {products.map((product) => (
            <Link key={product.slug} href={product.href}>
              {product.label}
            </Link>
          ))}
          <Link href="/sign-in">{t('common.signIn')}</Link>
        </div>
      </div>
    </footer>
  );
}
