'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, Menu, X } from 'lucide-react';
import { products } from '@/content/products';
import { cn } from '@/lib/utils';

export function Navbar() {
  const pathname = usePathname();
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
    pathname.startsWith('/demo');
  if (isAuth) return null;

  return (
    <>
      <header className={cn('topbar', (scrolled || openMenu) && 'is-scrolled')}>
        <div className="container topbar-inner">
          <Link href="/" className="brand" data-testid="link-brand">
            <img src="/logo-orarepot.png" alt="Ora Repot" className="brand-logo" />
          </Link>

          <nav className="nav-links" aria-label="Navigasi utama">
            <div className="nav-produk" ref={produkRef}>
              <button
                type="button"
                className={cn('nav-produk-trigger', openProduk && 'active')}
                aria-expanded={openProduk}
                aria-controls={menuId}
                onClick={() => setOpenProduk((v) => !v)}
                data-testid="button-produk-menu"
              >
                Produk <ChevronDown size={14} />
              </button>
              {openProduk && (
                <div id={menuId} className="produk-mega" role="menu">
                  <div className="produk-mega-col">
                    <p className="produk-mega-heading">Produk utama</p>
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
                    <p className="produk-mega-heading">Butuh panduan?</p>
                    <p>Coba OTP demo atau chat WhatsApp bot AI sekarang.</p>
                    <Link
                      href="/demo/di/orarepot?minat=ai"
                      className="button-primary dark"
                      onClick={() => setOpenProduk(false)}
                    >
                      Coba sekarang <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              )}
            </div>
            <Link href="/#solusi">Solusi</Link>
            <Link href="/harga/di/orarepot">Harga</Link>
            <Link href="/#faq">FAQ</Link>
          </nav>

          <div className="nav-actions">
            <Link href="/sign-in" className="nav-login" data-testid="link-signin">
              Masuk
            </Link>
            <Link href="/demo/di/orarepot" className="nav-cta" data-testid="button-nav-demo">
              Coba sekarang <ArrowRight size={14} />
            </Link>
          </div>

          <button
            type="button"
            className="menu-toggle"
            onClick={() => setOpenMenu((v) => !v)}
            aria-label="Buka menu"
            data-testid="button-mobile-menu"
          >
            {openMenu ? <X /> : <Menu />}
          </button>
        </div>

        {openMenu && (
          <nav className="mobile-nav" aria-label="Navigasi mobile">
            <p className="mobile-nav-label">Produk</p>
            {products.map((product) => (
              <Link key={product.slug} href={product.href} onClick={() => setOpenMenu(false)}>
                {product.label}
              </Link>
            ))}
            <Link href="/#solusi" onClick={() => setOpenMenu(false)}>
              Solusi
            </Link>
            <Link href="/harga/di/orarepot" onClick={() => setOpenMenu(false)}>
              Harga
            </Link>
            <Link href="/sign-in" onClick={() => setOpenMenu(false)}>
              Masuk
            </Link>
            <Link href="/demo/di/orarepot" className="nav-cta" onClick={() => setOpenMenu(false)}>
              Coba sekarang <ArrowRight size={14} />
            </Link>
          </nav>
        )}
      </header>
    </>
  );
}
