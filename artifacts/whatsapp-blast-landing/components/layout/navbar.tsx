'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, Menu, X } from 'lucide-react';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { useLocale } from '@/components/i18n/locale-provider';
import { getLocalizedProducts } from '@/lib/i18n/products';
import { cn } from '@/lib/utils';

export function Navbar() {
  const pathname = usePathname();
  const { locale, t } = useLocale();
  const products = useMemo(() => getLocalizedProducts(locale), [locale]);
  const [openMenu, setOpenMenu] = useState(false);
  const [openProduk, setOpenProduk] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuId = useId();
  const produkRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpenMenu(false);
    setOpenProduk(false);
  }, [pathname]);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 16);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!produkRef.current?.contains(event.target as Node)) {
        setOpenProduk(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenProduk(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const isAuth =
    pathname.startsWith('/sign-in') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/demo') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/admin');
  if (isAuth) return null;

  return (
    <>
      <header className={cn('topbar', (scrolled || openMenu) && 'is-scrolled')}>
        <div className="container topbar-inner">
          <Link href="/" className="brand" data-testid="link-brand">
            <img src="/logo-orarepot.svg" alt="Ora Repot" className="brand-logo" />
          </Link>

          <nav className="nav-links" aria-label={t('nav.mainNav')}>
            <div className="nav-produk" ref={produkRef}>
              <button
                type="button"
                className={cn('nav-produk-trigger', openProduk && 'active')}
                aria-expanded={openProduk}
                aria-controls={menuId}
                onClick={() => setOpenProduk((v) => !v)}
                data-testid="button-produk-menu"
              >
                {t('nav.products')} <ChevronDown size={14} />
              </button>
              {openProduk && (
                <div id={menuId} className="produk-mega" role="menu">
                  <div className="produk-mega-col">
                    <p className="produk-mega-heading">{t('nav.mainProducts')}</p>
                    {products.map((product) => {
                      const Icon = product.icon;
                      return (
                        <Link
                          key={product.slug}
                          href={product.href}
                          className="produk-mega-item"
                          role="menuitem"
                          onClick={() => setOpenProduk(false)}
                        >
                          <span className="produk-mega-icon">
                            <Icon size={18} />
                          </span>
                          <span>
                            <strong>{product.label}</strong>
                            <small>{product.shortTitle}</small>
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                  <div className="produk-mega-aside">
                    <p className="produk-mega-heading">{t('nav.needGuide')}</p>
                    <p>{t('nav.needGuideBody')}</p>
                    <Link
                      href="/demo/di/orarepot?minat=ai"
                      className="button-primary dark"
                      onClick={() => setOpenProduk(false)}
                    >
                      {t('common.tryNow')} <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              )}
            </div>
            <Link href="/#solusi">{t('nav.solutions')}</Link>
            <Link href="/harga/di/orarepot">{t('nav.pricing')}</Link>
            <Link href="/#faq">{t('nav.faq')}</Link>
          </nav>

          <div className="nav-actions">
            <LanguageSwitcher className="lang-switch-nav" />
            <Link href="/sign-in" className="nav-login" data-testid="link-signin">
              {t('common.signIn')}
            </Link>
            <Link href="/demo/di/orarepot" className="nav-cta" data-testid="button-nav-demo">
              {t('common.tryNow')} <ArrowRight size={14} />
            </Link>
          </div>

          <button
            type="button"
            className="menu-toggle"
            onClick={() => setOpenMenu((v) => !v)}
            aria-label={t('nav.openMenu')}
            data-testid="button-mobile-menu"
          >
            {openMenu ? <X /> : <Menu />}
          </button>
        </div>

        {openMenu && (
          <nav className="mobile-nav" aria-label={t('nav.mobileNav')}>
            <div className="px-1 pb-2">
              <LanguageSwitcher />
            </div>
            <p className="mobile-nav-label">{t('nav.products')}</p>
            {products.map((product) => (
              <Link key={product.slug} href={product.href} onClick={() => setOpenMenu(false)}>
                {product.label}
              </Link>
            ))}
            <Link href="/#solusi" onClick={() => setOpenMenu(false)}>
              {t('nav.solutions')}
            </Link>
            <Link href="/harga/di/orarepot" onClick={() => setOpenMenu(false)}>
              {t('nav.pricing')}
            </Link>
            <Link
              href="/sign-in"
              className="nav-login"
              onClick={() => setOpenMenu(false)}
            >
              {t('common.signIn')}
            </Link>
            <Link href="/demo/di/orarepot" className="nav-cta" onClick={() => setOpenMenu(false)}>
              {t('common.tryNow')} <ArrowRight size={14} />
            </Link>
          </nav>
        )}
      </header>
    </>
  );
}
